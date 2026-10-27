# Manipulating WebSocket messages to exploit vulnerabilities

## Lab Description :
![Cap dashboard screenshot](Ws-level-1-1.png)

## Overview :
The majority of input-based vulnerabilities affecting WebSockets can be found and exploited by tampering with the contents of WebSocket messages.

For example, suppose a chat application uses WebSockets to send chat messages between the browser and the server. When a user types a chat message, a WebSocket message like the following is sent to the server:

``{"message":"Hello Carlos"}``

The contents of the message are transmitted (again via WebSockets) to another chat user, and rendered in the user's browser as follows:

``<td>Hello Carlos</td>``
In this situation, provided no other input processing or defenses are in play, an attacker can perform a proof-of-concept XSS attack by submitting the following WebSocket message:

``{"message":"<img src=1 onerror='alert(1)'>"}``

## Solution :
The lab's home page has a link to Live chat.

![Cap dashboard screenshot](Ws-level-1-2.png)

There we have an option to chat or send message to another user.

![Cap dashboard screenshot](Ws-level-1-3.png)

We can view all the websocket requests & responses that have been sent and received under the Web Sockets history tab in Burp.

![Cap dashboard screenshot](Ws-level-1-4.png)

Since there is no sanitization of user input, we can send the following xss payload by intercepting the request & changing the value of message field in the JSON data.

``<img src=1 onerror='alert(1)'>``

![Cap dashboard screenshot](Ws-level-1-5.png)

Now both the client & the server users will get an XSS alert poopup.

![Cap dashboard screenshot](Ws-level-1-6.png)

And now we have solved the lab.

![Cap dashboard screenshot](Ws-level-1-7.png)

#### Visit The Next Page For The Next Level :)
