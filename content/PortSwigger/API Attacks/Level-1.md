# Exploiting an API endpoint using documentation

## Lab Description :
![Cap dashboard screenshot](api-level-1-1.png)

## Solution :
Login as Wiener with the provided credentials - wiener:peter.

Now when we change the email of wiener, the browser sends the folowing PATCH request to /api/user/wiener

![Cap dashboard screenshot](api-level-1-2.png)

If we remove user/wiener & send the request, we get the REST API documentation.

![Cap dashboard screenshot](api-level-1-3.png)

Now we can delete the user carlos by sending a DELETE request to /api/user/carlos.

![Cap dashboard screenshot](api-level-1-4.png)

Now we have deleted carlos's account & thus solved the lab.

![Cap dashboard screenshot](api-level-1-5.png)


#### Visit The Next Page For The Next Level :)
