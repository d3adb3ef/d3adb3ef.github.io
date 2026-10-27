# Inconsistent handling of exceptional input

## Lab Description :
![Cap dashboard screenshot](bl-level-6-1.png)

## Solution :
Finding admin panel -
First we need to find the URI of the admin panel inorder to delete the user carlos.

Go to Target -> Sitemap. Right click on the lab domain & select Engagement tools -> Discover content. to find what pages and directories are available in the website.

![Cap dashboard screenshot](bl-level-6-2.png)

When we try to browse to /admin, it says onnly persons belonging to DontWannaCry company can access this page.

![Cap dashboard screenshot](bl-level-6-3.png)

Account registration -
Go to registration page to create an account with the email id given to us - attacker@exploit-0ab1009903bcf40b8008753f01b300db.exploit-server.net

In the registration page, it is mentioned that we can use @dontwannacry.com if we are an employee of that company.

![Cap dashboard screenshot](bl-level-6-4.png)

Create an account with very long email address ending with @exploit-0ab1009903bcf40b8008753f01b300db.exploit-server.net.

Example - `` very-long-string@YOUR-EMAIL-ID.web-security-academy.net ``

NOTE - The very-long-string should be at least 200 characters long.

So I created an account with a very long string - aafafasighfiyuqabryuawgfibasifnkajsdbgiuafgijaeboifnaijfaokjfiuahfjiahgr90ipqjro89sygfduygsfdtuvdtGUYEDFGWYTDVUYVDuyGDUYucvuavcuyvauyvdfuaycvuayvcuyasvcuyavcuyavcuucauvcuayvclu2o3i1hri97uuc89273r89hiug987niuch89qn397yr89hiu7ay89qah45uiyr0q@exploit-0ab1009903bcf40b8008753f01b300db.exploit-server.net

![Cap dashboard screenshot](bl-level-6-5.png)

Once registered, we get an email .

![Cap dashboard screenshot](bl-level-6-6.png)

Click on the link & our registration is sucessful.

![Cap dashboard screenshot](bl-level-6-7.png)

Now login as that user using the creds that we've created - test1:1234

Once logged in we get this message but notice that the email address was truncated to 255 characters-

``aafafasighfiyuqabryuawgfibasifnkajsdbgiuafgijaeboifnaijfaokjfiuahfjiahgr90ipqjro89sygfduygsfdtuvdtGUYEDFGWYTDVUYVDuyGDUYucvuavcuyvauyvdfuaycvuayvcuyasvcuyavcuyavcuucauvcuayvclu2o3i1hri97uuc89273r89hiug987niuch89qn397yr89hiu7ay89qah45uiyr0q@exploit-0ab1009``

![Cap dashboard screenshot](bl-level-6-8.png)

KEY INFORMATION TO NOTE -
Total characters in original email used to register an account - 299 characters
Total characters in email after signing in - 255 characters
Register an account with @dontwannacry.com -
Now taking note of this behaviour, we can create a new account with more than 255 characters long & ends with our email-id but when the application truncates it, the last characters should be @dontwannacry.com

The email id to be used now is

``aaafasighfiyuqabryuawgfibasifnkajsdbgiuafgijaeboifnaijfaokjfiuahfjiahgr90ipqjro89sygfduygsfdtuvdtGUYEDFGWYTDVUYVDuyGDUYucvuavcuyvauyvdfuaycvuayvcuyasvcuyavcuyavcuucauvcuayvclu2o3i1hri97uuc89273r89hiug987niuch89qn397yr89hiu7ay89qah45uiyr0q@dontwannacry.com.exploit-0ab1009903bcf40b8008753f01b300db.exploit-server.net``

Create an account with the above email-id

![Cap dashboard screenshot](bl-level-6-9.png)

In the email inbox, click on the link to confirm registration.

![Cap dashboard screenshot](bl-level-6-10.png)

Now finally when we login, we can see that after it truncated , our rmail address ends wiht @dontwannacry.com.

![Cap dashboard screenshot](bl-level-6-11.png)

We can now access the admin panel at /admin.

![Cap dashboard screenshot](bl-level-6-12.png)

Delete the user carlos to solve the lab.

![Cap dashboard screenshot](bl-level-6-13.png)

#### Visit The Next Page For The Next Level :)

