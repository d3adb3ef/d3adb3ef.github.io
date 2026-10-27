# Unprotected admin functionality

## Lab Description :
![Cap dashboard screenshot](ac-level-1-1.png)

## Solution :
When the lab loads, we get the ususal shopping website.

Clicking on My Account page takes us to /login endpoint

![Cap dashboard screenshot](ac-level-1-2.png)

Now we need to bypass this login page and directly access the admin page.

For that we can look for one of the common web directories like the robots.txt and sitemap.xml

robots.txt
![Cap dashboard screenshot](ac-level-1-3.png)

We see a disallowed login entry here for the admin panel which is /administrator-panel.

On visiting the ``/administrator-panel`` directory, we get the admin panel.

![Cap dashboard screenshot](ac-level-1-4.png)

So we click the link to delete the user carlos to solve the lab.

![Cap dashboard screenshot](ac-level-1-5.png)

#### Visit The Next Page For The Next Level :)

