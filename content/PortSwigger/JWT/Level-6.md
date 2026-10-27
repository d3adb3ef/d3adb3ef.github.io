# JWT authentication bypass via kid header path traversal

## Lab Description :
![Cap dashboard screenshot](jwt-level-6-1.png)

## Overview :
Servers may use several cryptographic keys for signing different kinds of data, not just JWTs. For this reason, the header of a JWT may contain a kid (Key ID) parameter, which helps the server identify which key to use when verifying the signature. JWS specification doesn't define a concrete structure for this ID - it's just an arbitrary string of the developer's choosing. For example, they might use the kid parameter to point to a particular entry in a database, or even the name of a file

If this parameter is also vulnerable to directory traversal, an attacker could potentially force the server to use an arbitrary file from its filesystem as the verification key.
```
{
    "kid": "../../path/to/file",
    "typ": "JWT",
    "alg": "HS256",
    "k": "asGsADas3421-dfh9DGN-AFDFDbasfd8-anfjkvc"
} 
```
This is especially dangerous if the server also supports JWTs signed using a symmetric algorithm. In this case, an attacker could potentially point the kid parameter to a predictable, static file, then sign the JWT using a secret that matches the contents of this file.
One of the simplest methods is to use /dev/null

As this is an empty file, reading it returns an empty string. Therefore, signing the token with a empty string will result in a valid signature.

## Solution :
Login as wiener using the credentials provided.

The following requests have JWT in it. 

![Cap dashboard screenshot](jwt-level-6-2.png)

Send the GET request sent to /admin to repeater tab.

The JWT token used in the request is ,

``eyJraWQiOiIwMDc4ZjEzZi05YTM5LTQ0NTgtYjRhZi03OWRkYzhmZjdlYmQiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJwb3J0c3dpZ2dlciIsInN1YiI6IndpZW5lciIsImV4cCI6MTY5NTcyOTU0Nn0.K6mkOhz-r8aU7CNjVz8S16wa7TXvfZMJk8ctUEN7Z4c``

Decode it using jwt.io

Header -
```
{
  "kid": "0078f13f-9a39-4458-b4af-79ddc8ff7ebd",
  "alg": "HS256"
}
```
Payload -
```
{
  "iss": "portswigger",
  "sub": "wiener",
  "exp": 1695729546
}
```
Go to Jason Web Token tab. Change the kid to "kid": "../../../dev/null" & sub to "sub": "administrator".

Since the content of kid ie /dev/null is null, we need to specify the secret key to be null before signing the JWT token.

But we can specify NULL in the secret value in this extension so we need to Base64-encode the NULL value - \x00

The Base64 encoded value of null is - AA==.

Now using the JWT Editor, Create a new symmetric key (Since HMACSHA256 is used).

Generate the key & replace the secret as AA==.

![Cap dashboard screenshot](jwt-level-6-3.png)

Now the file that the kid points is null & so we can now sign the token with a empty string & it is still valid !!

We now have the following JWT.

``eyJraWQiOiIuLi8uLi8uLi8uLi8uLi8uLi8uLi9kZXYvbnVsbCIsImFsZyI6IkhTMjU2In0.eyJpc3MiOiJwb3J0c3dpZ2dlciIsInN1YiI6ImFkbWluaXN0cmF0b3IiLCJleHAiOjE2OTU3Mjk1NDZ9.z7n4FC7_cH6RLq_Ra_2Z9884jrsN9ZYbMhW4KfVEi4M``

Now replace the JWT with the one we just created & forward the request .

Now we have access to admin panel.

![Cap dashboard screenshot](jwt-level-6-4.png)

Delete the user carlos to solve the lab.

![Cap dashboard screenshot](jwt-level-6-5.png)
