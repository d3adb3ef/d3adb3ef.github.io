# SSRF with whitelist-based input filter

## Lab Description :
![Cap dashboard screenshot](ssrf-level-7-1.png)

## Overview :
Some applications only allow input that matches, begins with, or contains, a whitelist of permitted values. In this situation, you can sometimes circumvent the filter by exploiting inconsistencies in URL parsing.

You can embed credentials in a URL before the hostname, using the @ character. For example:

``https://expected-host:fakepassword@evil-host``

You can use the # character to indicate a URL fragment. For example:

``https://evil-host#expected-host``

You can leverage the DNS naming hierarchy to place required input into a fully-qualified DNS name that you control. For example:

``https://expected-host.evil-host``

You can URL-encode characters to confuse the URL-parsing code. This is particularly useful if the code that implements the filter handles URL-encoded characters differently than the code that performs the back-end HTTP request. Note that you can also try double-encoding characters; some servers recursively URL-decode the input they receive, which can lead to further discrepancies.

## Solution :
In this lab, there is whitelisting done at the backend. So only the whilelisted inputs will be accepted as i/p. So our normal way to access the admin panel - http://localhost/admin fails.
```html
HTTP/2 400 Bad Request
Content-Type: application/json; charset=utf-8
X-Frame-Options: SAMEORIGIN
Content-Length: 58
```

"External stock check host must be stock.weliketoshop.net"
This means that the application accepts the request only if it contains stock.weliketoshop.net.

Lets try giving username@stock.weliketoshop.net. Here we can also give localhost as the username portion in the url.

![Cap dashboard screenshot](ssrf-level-7-2.png)

The request is accepted & we get a 400 response back.This time it doesn't show the error External stock check host must be stock.weliketoshop.net ,which means the username part is accepted by the application.

Changing it to localhost also gives a 200 OK response.

![Cap dashboard screenshot](ssrf-level-7-3.png)

Next is to use the # - URL fragment to make the server not to interpret the part after the # as a part of the request.

Now when we give the i/p url as ``http://localhost#@stock.weliketoshop.net``, we get this error - External stock check host must be stock.weliketoshop.net

This time it doesn't show missing parameter error. This means it accepts localhost as the domain and everything after the # as a URL fragment.So the localhost word gets whitelisted here.

![Cap dashboard screenshot](ssrf-level-7-4.png)

Next on , we try to double encode the # ie (http://localhost%2523@stock.weliketoshop.net/) to bypass this.

Now we're able to accesss the localhost website.

![Cap dashboard screenshot](ssrf-level-7-5.png)

/admin panel -

Access the url ``http://localhost%2523@stock.weliketoshop.net/admin``

![Cap dashboard screenshot](ssrf-level-7-6.png)

We also got the uri to delete the user carlos.

Now make a request to ``http://localhost%2523@stock.weliketoshop.net/admin/delete?username=carlos``

![Cap dashboard screenshot](ssrf-level-7-7.png)

Thus we deleted the carlos usre & solved the lab.

![Cap dashboard screenshot](ssrf-level-7-8.png)

