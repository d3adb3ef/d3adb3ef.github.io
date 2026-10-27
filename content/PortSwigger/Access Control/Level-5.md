# User ID controlled by request parameter

## Lab Description :
![Cap dashboard screenshot](ac-level-5-1.png)

## Solution :
When ther lab loads , we see the usual shopping website. Clicking on My account takes us to a login page.

![Cap dashboard screenshot](ac-level-5-2.png)

We enter the credentials which is given in the lab description - wiener:peter

When we login we get to see the API key of wiener - T9VQGi3yf81cho2IzdP5jN61hT9zc1YA

![Cap dashboard screenshot](ac-level-5-3.png)

To solve the lab , we need to retreive the API key of carlos user.

When we click on My Account after loggin in as wiener, a request is sent like this

![Cap dashboard screenshot](ac-level-5-4.png)

It contains ``?id=wiener`` parameter.

Change the value to carlos , we get the API key of carlos and thus solved the lab

![Cap dashboard screenshot](ac-level-5-5.png)

![Cap dashboard screenshot](ac-level-5-6.png)

#### Visit The Next Page For The Next Level :)
