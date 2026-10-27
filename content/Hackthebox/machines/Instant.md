---
title: "Instant"
---

# Hack The Box - Instant

![Cap dashboard screenshot](instant.png)


Instant is a medium Linux machine that starts with a mobile app, continues with Swagger API abuse, and ends with credential reuse and offline decryption. I used JADX to inspect the Android APK, recovered an admin JWT, exploited path traversal in a log-reading endpoint, and then cracked a database hash to reach the final root credentials.

## Reconnaissance

I began with a port scan to identify the exposed services.

```text
PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.6p1 Ubuntu 3ubuntu13.5 (Ubuntu Linux; protocol 2.0)
80/tcp open  http    Apache httpd 2.4.58
|_http-server-header: Apache/2.4.58 (Ubuntu)
|_http-title: Did not follow redirect to http://instant.htb/
Service Info: Host: instant.htb; OS: Linux; CPE: cpe:/o:linux:linux_kernel
```

The scan only showed SSH and HTTP, so I added `instant.htb` to `/etc/hosts` and opened the website.

![Cap dashboard screenshot](instant-1.png)

## Web App

The page advertised a money transfer service and offered an Android app for download. Since I did not want to emulate a device right away, I inspected the APK with JADX and decompiled the Java source.

Inside the app code, one file stood out: `AdminActivities`. It contained a function that sent a request to:

![Cap dashboard screenshot](instant-2.png)


```text
http://mywalletv1.instant.htb/api/v1/view/profile
```

The request used a hard-coded Authorization token. That token was still valid, so I suspected the API could be accessed directly with admin privileges.

The APK also revealed another domain in `network_security_config.xml`:

![Cap dashboard screenshot](instant-3.png)

```text
swagger-ui.instant.htb
```

I added that host as well and found a Swagger interface for the API. Using the recovered token in the authorization field allowed me to query endpoints directly, and the profile endpoint confirmed I was talking to the admin account.

## Log Traversal

The Swagger API exposed endpoints for users, transactions, and logs. The log functionality was especially interesting because it likely accessed files on disk.

Listing logs returned just one file:

```json
{
  "Files": [
    "1.log"
  ],
  "Path": "/home/shirohige/logs/",
  "Status": 201
}
```

Reading `1.log` worked as expected, so I tried path traversal. That succeeded, letting me read files outside the intended directory, including `/etc/passwd`.

![Cap dashboard screenshot](instant-4.png)

Since the logs appeared to live under `shirohige`’s home directory, I tested access to the SSH key next. I was able to read `/home/shirohige/.ssh/id_rsa` and reconstruct the private key from the API response.

```bash
curl -sS \
     -X GET \
     "http://swagger-ui.instant.htb/api/v1/admin/read/log?log_file_name=..%2F..%2F..%2F..%2Fhome%2Fshirohige%2F.ssh%2Fid_rsa" \
     -H  "accept: application/json" \
     -H  "Authorization: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZSI6IkFkbWluIiwid2FsSWQiOiJmMGVjYTZlNS03ODNhLTQ3MWQtOWQ4Zi0wMTYyY2JjOTAwZGIiLCJleHAiOjMzMjU5MzAzNjU2fQ.v0qyyAqDSgyoNFHU7MgRQcDA0Bw99_8AEXKGtWZ6rYA" \
     | jq -r 'to_entries[0].value | join("")' \
     | tee -a ssh.key
```

## Shell as shirohige

After saving the recovered key and fixing its permissions, I used it to SSH in as `shirohige`.

That gave me the first shell and access to the user flag.

## Database Review

Next I looked through the application source and found the SQLite database used by the web app. I copied `instant.db` off the host and inspected it locally.

The `wallet_users` table contained two user records, including password hashes in `pbkdf2:sha256` format.

```text
1|instantAdmin|admin@instant.htb|...|pbkdf2:sha256:600000$I5bFyb0ZzD69pNX8$e9e4ea5c280e0766612295ab9bff32e5fa1de8f6cbb6586fab7ab7bc762bd978|...
2|shirohige|shirohige@instant.htb|...|pbkdf2:sha256:600000$YnRgjnim$c9541a8c6ad40bc064979bc446025041ffac9af2f762726971d8a28272c550ed|...
```

I converted the hashes into the format expected by hashcat and cracked `shirohige`’s password:

```text
estrella
```

## Solar-PuTTY Backup

On the Windows side of the challenge, I found a Solar-PuTTY backup file:

```text
/opt/backups/Solar-PuTTY/sessions-backup.dat
```

The repository included a decryptor, but it required the passphrase. Using the recovered password `estrella`, I decrypted the session file https://github.com/VoidSec/SolarPuttyDecrypt and recovered the root credential:

```text
Username: root
Password: 12**24nzC!r0c%q12
```

## Root Access

With the root password in hand, I switched to the privileged account and read the final flag.

## Attack Path

- Enumerate the host and discover SSH and HTTP.
- Download and inspect the Android APK with JADX.
- Recover a hard-coded admin JWT from the app source.
- Discover Swagger and use the token to access API endpoints.
- Abuse log path traversal to read arbitrary files.
- Extract the SSH private key for `shirohige`.
- Log in as `shirohige`.
- Pull the SQLite database and crack the PBKDF2 hash.
- Decrypt the Solar-PuTTY backup with the recovered password.
- Extract the root password and complete the box.
