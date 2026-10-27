# User role can be modified in user profile

## Lab Description :
![Cap dashboard screenshot](ac-level-4-1.png)

## Solution :
So as per the lab description, we can view the admin panel only if our roleID=2.

GET request to /myaccount -
Once we click my account link, the browser sends a req as follows.

![Cap dashboard screenshot](ac-level-4-2.png)

GET request o /login -
This request retreives the login page to enter the username and password.

![Cap dashboard screenshot](ac-level-4-3.png)

Login page -

![Cap dashboard screenshot](ac-level-4-4.png)

Enter the credentials which are given for testing which is wiener:peter& click LOGIN button, the captured request is as follows

![Cap dashboard screenshot](ac-level-4-5.png)

Now we have logged in as wiener,

![Cap dashboard screenshot](ac-level-4-6.png)

Till now we didn't see any suspicious cookie values being sent from our client

Lets move on & try to update our email.

![Cap dashboard screenshot](ac-level-4-7.png)

Request :

![Cap dashboard screenshot](ac-level-4-8.png)

Send the request to repeater (I tried sending all the previous requests to repeater, it didn't have the roleid cookie either in request or response)

Response :

![Cap dashboard screenshot](ac-level-4-9.png)

Observe that we have a roleid=1 in the JSON response.

So add the value roleid=2 in the JSON request & see what is the response in browser

![Cap dashboard screenshot](ac-level-4-10.png)

We have a 302 redirect

![Cap dashboard screenshot](ac-level-4-11.png)

Click Follow redirect,

![Cap dashboard screenshot](ac-level-4-12.png)

Now we can see the link to Admin Panel in the browser.

![Cap dashboard screenshot](ac-level-4-13.png)

Now click on admin panel & delete the carlos user to solve the lab.

![Cap dashboard screenshot](ac-level-4-14.png)

#### Visit The Next Page For The Next Level :)
