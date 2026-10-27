# Username enumeration via subtly different responses

## Lab Description :
![Cap dashboard screenshot](auth-level-4-1.png)

## Solution :
Captured request -

![Cap dashboard screenshot](auth-level-4-2.png)

All the responses look then same. 

![Cap dashboard screenshot](auth-level-4-3.png)

From this right click any one of the request -> Define extract grep from response option. 

![Cap dashboard screenshot](auth-level-4-4.png)

A new dialog box appears, 

![Cap dashboard screenshot](auth-level-4-5.png)

Scroll down & highlight Invalid username or password , the regex fields automatically gets updated.

Now start the attack,

We can see that there is a typo in only one response 

![Cap dashboard screenshot](auth-level-4-6.png)

Here one thing stands out, this response has Invalid username or password  rather than Invalid username or password ie.trailing fullstop & space is missing. 

![Cap dashboard screenshot](auth-level-4-7.png)

Now update the username to arlington , add the password field as target , add payload of passwords and start the attack.

We get a 302 status code which indicates that it is the password

![Cap dashboard screenshot](auth-level-4-8.png)

#### Visit The Next Page For The Next Level :)

