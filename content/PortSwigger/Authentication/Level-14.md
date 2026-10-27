# 2FA bypass using a brute-force attack

### Brute-forcing 2FA verification codes :
As with passwords, websites need to take steps to prevent brute-forcing of the 2FA verification code. This is especially important because the code is often a simple 4 or 6-digit number. Without adequate brute-force protection, cracking such a code is trivial.

Some websites attempt to prevent this by automatically logging a user out if they enter a certain number of incorrect verification codes. This is ineffective in practice because an advanced attacker can even automate this multi-step process by creating macros for Burp Intruder. The Turbo Intruder extension can also be used for this purpose.

## Lab Description :
![Cap dashboard screenshot](auth-level-14-1.png)

## Solution :
Blog on Burp Macros - ``https://akshita-infosec.medium.com/burp-macros-what-why-how-151df8901641``

![Cap dashboard screenshot](auth-level-14-2.png) 

![Cap dashboard screenshot](auth-level-14-3.png) 

![Cap dashboard screenshot](auth-level-14-4.png)

![Cap dashboard screenshot](auth-level-14-5.png)

HTTP history

![Cap dashboard screenshot](auth-level-14-6.png)

Project options -> Sessions tab

![Cap dashboard screenshot](auth-level-14-7.png)

Under Session Handling Rules -> Add

![Cap dashboard screenshot](auth-level-14-8.png)

Click scope

![Cap dashboard screenshot](auth-level-14-9.png)

Go back to details tab

![Cap dashboard screenshot](auth-level-14-10.png)

![Cap dashboard screenshot](auth-level-14-11.png)

![Cap dashboard screenshot](auth-level-14-12.png)

![Cap dashboard screenshot](auth-level-14-13.png)

