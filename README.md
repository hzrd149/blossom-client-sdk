# 🌸 blossom-client-sdk

A client for manage blobs on blossom servers

[Documentation](https://hzrd149.github.io/blossom-client-sdk/classes/BlossomClient)

## Using the static methods

```js
import { BlossomClient } from "blossom-client-sdk";

async function signer(event) {
  return await window.nostr.signEvent(event);
}

// create an upload auth event
const uploadAuth = await BlossomClient.getUploadAuth(file, server, "Upload bitcoin.pdf");

// encode it using base64
const encodedAuthHeader = BlossomClient.encodeAuthorizationHeader(auth);

// manually make the request
const res = await fetch(new URL("/upload", server), {
  method: "PUT",
  body: file,
  headers: { authorization: encodedAuthHeader },
});

// or use the static method
const res = await BlossomClient.uploadBlob(server, file, uploadAuth);

// check if successful
if (res.ok) {
  console.log("Blob uploaded!");
}
```

## Using the class

The `BlossomClient` class can be used to talk to a single server

```js
import { BlossomClient } from "blossom-client-sdk";

async function signer(event) {
  return await window.nostr.signEvent(event);
}

const client = new BlossomClient("https://cdn.example.com", signer);

const pubkey = "266815e0c9210dfa324c6cba3573b14bee49da4209a9456f9484e5106cd408a5";
const blobs = await client.listBlobs(pubkey, undefined, true);
// passing true as the last argument will make it send an auth event with the list request
```

## Examples

### List all blobs on a server

```js
import { BlossomClient } from "blossom-client-sdk";

async function signer(event) {
  return await window.nostr.signEvent(event);
}

const pubkey = "266815e0c9210dfa324c6cba3573b14bee49da4209a9456f9484e5106cd408a5";
const server = "https://cdn.example.com";

async function listBlobs() {
  try {
    return BlossomClient.listBlobs(server, pubkey);
  } catch (e) {
    if (e.status === 401) {
      const auth = await BlossomClient.getListAuth(signer, "List Blobs from " + server);
      return BlossomClient.listBlobs(server, pubkey, undefined, auth);
    }
  }
}
```

### Upload a single blob

```js
import { BlossomClient } from "blossom-client-sdk";

async function signer(event) {
  return await window.nostr.signEvent(event);
}

const client = new BlossomClient("https://cdn.example.com", signer);

const blobs = await client.listBlobs();

await client.uploadBlob(new File(["testing"], "test.txt"));
```

### Upload a single blob to multiple servers

```js
import { BlossomClient } from "blossom-client-sdk";

async function signer(event) {
  return await window.nostr.signEvent(event);
}

const servers = ["https://cdn.example.com", "https://cdn.other.com"];
const file = new File(["testing"], "test.txt");

const auth = await BlossomClient.getUploadAuth(file, signer, "Upload test.txt");

for (let server of servers) {
  await BlossomClient.uploadBlob(server, file, auth);
}
```
