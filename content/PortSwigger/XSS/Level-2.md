# Stored XSS into HTML context with nothing encoded

## Lab Description :
![Cap dashboard screenshot](xss-level-2-1.png)

## Solution :
This time we have a blog website. We have a functionality to post comments.

![Cap dashboard screenshot](xss-level-2-2.png)

We can use the following XSS payload in the comment field to perform a stored Xss attack.

``<script>alert(1)</script>``

Now each time when the page containing the comment is reloaded, it triggers an alert.

![Cap dashboard screenshot](xss-level-2-3.png)

Thus the lab is solved.

![Cap dashboard screenshot](xss-level-2-4.png)


#### Visit The Next Page For The Next Level :)
