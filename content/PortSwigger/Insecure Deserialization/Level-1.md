# Modifying serialized objects

## Lab Description :
![Cap dashboard screenshot](id-level-1-1.png)

## Solution :
Login with the credentials provided - wiener:peter.

Upon login we see that the user's cookie is a PHP serialize object.

![Cap dashboard screenshot](id-level-1-2.png)

The cookie contains a attribute called admin:0 which means false.

Change the boolean attribute to 1 & convert it back to proper encopding as it was before.

`` O:4:"User":2:{s:8:"username";s:6:"wiener";s:5:"admin";b:0;} ``

Upon replacing the old cookie in dev tools with the cookie that we have created , we can now see the hyperlink to access the admin panel. image

We now have privilege to delete user accounts.

![Cap dashboard screenshot](id-level-1-3.png)

Delete the user carlos to solve the lab.

![Cap dashboard screenshot](id-level-1-4.png)

#### Visit The Next Page For The Next Level :)
