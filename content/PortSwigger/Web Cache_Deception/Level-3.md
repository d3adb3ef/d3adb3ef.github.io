# Exploiting origin server normalization for web cache deception

## Lab Description :
![Cap dashboard screenshot](Wd-level-3-1.png)

## Solution :
Log into the site using the credentials provided - wiener:peter.

Analyzing cache rule & normalization behaviour of cache server -
The GET request the static resource at /resource endpoint is being cached.

![Cap dashboard screenshot](Wd-level-3-2.png)

Now we to identify what is the cache rule that is configured.

Appending a random directory at the start of the path , we see that the response comes from the origin server & not the cache.
![Cap dashboard screenshot](Wd-level-3-3.png)

This means the cache rule is set such a way that it caches any path that starts with /resources directory. This also means that the cache server does not normalize the URL path

Now we also need to check whether the cache rule considers the static file extension also.
![Cap dashboard screenshot](Wd-level-3-4.png)

From the above image, we can observe that the response is cached eventhough the static extension is not present.

Analyzing Origin server's normalization behaviour -
Upon adding a random path prefix with dot sequence, it was observed that the origin server normalizes the path & thus returns the profile info in the response.

![Cap dashboard screenshot](Wd-level-3-5.png)

This confirms that the Origin server normalizes the URL

Crafting an exploit -
So based on our analysis, we know that

The cache server caches the reponse if the URI starts with /resource static directory.

Only the Origin server performs path normalization

So we can use the following payload in the exploit server to send the link to carlos on which he will click on it.
```html
<script>document.load="https://0a6100a903a0f1fd80a8b21c00d70049.web-security-academy.net/resources/abc/..%2f..%2fmy-account"</script>
```
Once carlos clicks on the link, we can get the API key of carlos just by visiting the endpoint unauthenticated.

![Cap dashboard screenshot](Wd-level-3-6.png)

Now submit the API key of carlos to solve the lab.

![Cap dashboard screenshot](Wd-level-3-7.png)

#### Visit The Next Page For The Next Level :)

