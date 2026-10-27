#  OS command injection, simple case

```text
This lab contains an OS command injection `vulnerability in the product stock checker`.
The application executes a shell command containing user-supplied product and store IDs, and returns the raw output from the command in its response.
To solve the lab, execute the `whoami` command to determine the name of the current user.
```

## Solution -
- Vulnerability is in check stock filter

![Cap dashboard screenshot](ci-level-1-1.png)

- We need to check which parameter is vulnerable ``[productID or storeID]``

productID

#### Request -

![Cap dashboard screenshot](ci-level-1-2.png)

#### Response -

![Cap dashboard screenshot](ci-level-1-3.png)

It's not showing the o/p of whoami, so this parameter is not vulnerable.

storeID

#### Request -

![Cap dashboard screenshot](ci-level-1-4.png)

#### Response -

![Cap dashboard screenshot](ci-level-1-5.png)

After Geting The Username It Should Slove The Lab

#### Visit The Next Page For The Next Level :)
