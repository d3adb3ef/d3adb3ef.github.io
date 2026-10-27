# URL-based access control can be circumvented

## Lab Description :
![Cap dashboard screenshot](ac-level-10-1.png)

## Solution :
When the lab website loads, we straighaway see the Admin panel link present.

![Cap dashboard screenshot](ac-level-10-2.png)

When we click it we get Access Denied.

![Cap dashboard screenshot](ac-level-10-3.png)

We capture the request in burp .It looks like

![Cap dashboard screenshot](ac-level-10-4.png)

The hint given in the lab description helps us to bypass this ,

Hint - The back-end application is built on a framework that supports the X-Original-URL header.

Some application frameworks support various non-standard HTTP headers that can be used to override the URL in the original request, such as X-Original-URL and X-Rewrite-URL. If a web site uses rigorous front-end controls to restrict access based on URL, but the application allows the URL to be overridden via a request header, then it might be possible to bypass the access controls using a request like the following:

```text
POST / HTTP/1.1
X-Original-URL: /admin/deleteUser
```
Top bypass this 403, we should remove the /admin which is with the GET method in the URI in the request & add the X-Original-Url : /admin to the body of the request.

Common mistake is that we add the endpoint both in the ``X-Original-Url`` & also at the GET method.

`` [Ref - sting8k/BurpSuite_403Bypasser#4]``

![Cap dashboard screenshot](ac-level-10-5.png)

So the request which we send has to look like this ,

![Cap dashboard screenshot](ac-level-10-6.png)

Thus we got the admin panel.

![Cap dashboard screenshot](ac-level-10-7.png)

If we click on the link to delete user carlos, we again get access-denied.

So we have to add the custom header in this request too !

Actual request -
![Cap dashboard screenshot](ac-level-10-8.png)

Modified request

Add the ``X-Original-Url: /admin/delete`` header

Provide the username=carlos parameter as it is in the real query string.

![Cap dashboard screenshot](ac-level-10-9.png)

![Cap dashboard screenshot](ac-level-10-10.png)

#### Visit The Next Page For The Next Level :)
