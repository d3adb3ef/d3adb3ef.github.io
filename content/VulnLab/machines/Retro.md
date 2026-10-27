---
title: "Retro"
---

# VulnLab - Retro Writeup

![Cap dashboard screenshot](retro.png)

Retro is an easy Windows machine from VulnLab that focuses on AD enumeration, pre-created machine account abuse, and ADCS exploitation. The path starts with anonymous-style access through exposed directory services, then moves through a password reset on a machine account, and ends with certificate abuse to compromise the domain administrator.

## Summary

The target exposed Kerberos, LDAP, and related Active Directory services. Initial LDAP access was not anonymous, but the Guest account worked, which made it possible to enumerate users and shares.

A note in the `Trainees` share revealed a bundled training account, `trainee:trainee`, and that unlocked access to the `Notes` share. A second note pointed to a pre-created machine account, `BANKING$`, which could be reset because it had not been authenticated yet.

After resetting `BANKING$`, I enumerated the domain with BloodHound and ran certificate discovery with Certipy. That revealed a vulnerable certificate template, `RetroClients`, which was misconfigured for ESC1. Using the machine account, I requested a certificate for `administrator@retro.vl`, authenticated with it, and recovered the administrator hash.

## Enumeration

The first Nmap scan showed a classic AD-only surface: Kerberos, LDAP, LDAPS, and RPC-related services. The certificate on LDAP also exposed the domain controller hostname, `DC.retro.vl`, which was enough to add the hostnames to `/etc/hosts`.

```bash
nmap -sV -sC -Pn 10.10.122.138
```

The machine did not expose SMB or web services in the scan output, so the attack path clearly depended on directory services and domain object abuse.

## User Discovery

Anonymous LDAP did not work, but the Guest account did. That allowed RID brute forcing, which returned a small but useful list of identities.

```bash
nxc smb retro.vl -u "Guest" -p ""
nxc smb retro.vl -u "Guest" -p "" --rid-brute
```

The recovered names included:

- `jburley`
- `HelpDesk`
- `tblack`
- `trainee`
- `DC$`
- `BANKING$`

Spraying a blank password found that `HelpDesk` accepted the login, but the more useful clue came from SMB shares.

## SMB Shares

Anonymous SMB access was enabled, and the `Trainees` share contained `Important.txt`. That file explained that all trainees had been consolidated into a single account with an easy password.

```bash
smbclient -L //retro.vl//
smbclient -U trainee%trainee \\\\retro.vl\\Notes
```

The bundled account worked:

- `trainee:trainee`

Using that account, the `Notes` share became available and contained `ToDo.txt`. That file mentioned a pre-created machine account that was older than the author.

## Machine Account Reset

The `ToDo.txt` hint pointed to a pre-created computer account, which is a known AD feature where the initial password can be the lowercase machine name. The `BANKING$` account behaved like an untouched machine account, so I reset its password successfully.

```bash
changepasswd.py -protocol rpc-samr retro.vl/BANKING\$@10.10.122.138 -newpass Password123
```

Once reset, the machine account could be used like a normal domain credential. That opened the door to deeper AD enumeration.

## BloodHound and ADCS

I ran BloodHound against the domain with `BANKING$` and found a very small graph, but it was enough to motivate certificate enumeration. Certipy then identified the `RetroClients` template as vulnerable to ESC1.

```bash
bloodhound-python -d retro.vl -u BANKING$ -p 'Password123' -ns 10.10.122.138 -c all
certipy find -username BANKING\$@retro.vl -password Password123 -target-ip 10.10.122.138
```

The critical template properties were:

- `Domain Computers` had enrollment rights.
- The template allowed user-supplied subject information.
- The template supported client authentication.

That meant the `BANKING$` account could request a certificate for another principal, including Administrator.

## Certificate Abuse

The first certificate request failed because the key size was too small, so I retried with a 4096-bit key. That worked and produced a PFX for `administrator@retro.vl`.

```bash
certipy req -username BANKING\$@retro.vl -password Password123 -target-ip 10.10.122.138 -ca 'retro-DC-CA' -template 'RetroClients' -upn 'administrator@retro.vl' -key-size 4096 -debug
```

With the certificate in hand, I authenticated to the domain and retrieved the NT hash for Administrator.

```bash
certipy auth -pfx 'administrator.pfx' -username 'Administrator' -domain 'retro.vl' -dc-ip 10.10.122.138
```

That completed the compromise chain and gave full domain admin access.

## Final Access

With the administrator hash recovered, I could authenticate with WinRM and retrieve the flag. The machine’s main lesson is that weak machine-account handling plus a vulnerable certificate template can collapse an AD environment very quickly.

## Attack Path

- Enumerate the domain with Guest access.
- RID brute force the directory.
- Find the `Trainees` share and recover `trainee:trainee`.
- Read the note about the pre-created machine account.
- Reset the `BANKING$` machine account password.
- Enumerate the domain with BloodHound.
- Discover the ESC1-vulnerable `RetroClients` certificate template.
- Request a certificate for `administrator@retro.vl`.
- Authenticate with the certificate and recover the Administrator hash.
- Use the admin credentials to finish the machine.
