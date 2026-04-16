# 🌸 blossom-client-sdk

A client for managing blobs on blossom servers

[Documentation](https://hzrd149.github.io/blossom-client-sdk/)

## Basic Usage

```js
import { uploadBlob, createUploadAuth, encodeAuthorizationHeader } from "blossom-client-sdk";

async function signer(event) {
  return await window.nostr.signEvent(event);
}

const server = "https://cdn.example.com";

// create an upload auth event
const uploadAuth = await createUploadAuth(signer, file);

// encode it using base64
const encodedAuthHeader = encodeAuthorizationHeader(uploadAuth);

// manually make the request
const res = await fetch(new URL("/upload", server), {
  method: "PUT",
  body: file,
  headers: { authorization: encodedAuthHeader },
});

// or use the action function
const blob = await uploadBlob(server, file, {
  onAuth: async (server, sha256, type) => createUploadAuth(signer, sha256, { type }),
});
```

### Using with NDK

The auth and action functions optionally take a `signer` method that is used to sign the auth events

If your using NDK in your app you can use this method

```ts
const signer = async (draft: EventTemplate) => {
  // add the pubkey to the draft event
  const event: UnsignedEvent = { ...draft, pubkey: user.pubkey };
  // get the signature
  const sig = await ndk.signer!.sign(event);

  // return the event + id + sig
  return { ...event, sig, id: getEventHash(event) };
};
```

## Helper Methods

### Getting the hash from a URL

The `getHashFromURL` method will return the last SHA256 hash it finds in a URL

```js
import { getHashFromURL } from "blossom-client-sdk";

// blossom compatible URLs
console.log(
  getHashFromURL("https://cdn.example.com/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553.pdf"),
);
// -> b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553

// non-blossom URLs
console.log(
  getHashFromURL(
    "https://cdn.example.com/266815e0c9210dfa324c6cba3573b14bee49da4209a9456f9484e5106cd408a5/media/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553.pdf",
  ),
);
// -> b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553

// returns null when no hash is found
console.log(getHashFromURL("https://example.com/index.html"));
// -> null
```

### Handling broken images

This package also exports a few helper methods for handling broken images

The `handleImageFallbacks(image, getServers)` method listen for an `error` event on an `<img/>` element and if the element has a `data-pubkey` attribute. it will call `getServers` to ask for a list of blossom servers for the pubkey

```js
import { handleImageFallbacks, USER_BLOSSOM_SERVER_LIST_KIND, getServersFromServerListEvent } from "blossom-client-sdk";

const image = new Image();
image.src = "https://cdn.censorship.com/72cb99b689b4cfe1a9fb6937f779f3f9c65094bf0e6ac72a8f8261efa96653f5.png";

// set the pubkey from the kind 1 event this image was found it
image.dataset.pubkey = event.pubkey;

// this is called when
async function getServers(pubkey) {
  if (pubkey) {
    // use NDK to find the users blossom server list event (k:10063)
    const event = await ndk.fetchEvent({ kinds: [USER_BLOSSOM_SERVER_LIST_KIND], authors: [pubkey] });

    // if its found return a list of blossom servers
    if (event) return getServersFromServerListEvent(event);
  }
  return undefined;
}

// listen for "error" events
handleImageFallbacks(image, getServers);

document.body.appendChild(image);
```

## Other Examples

### List a page of blobs on a server

```js
import { listBlobs, createListAuth } from "blossom-client-sdk";

async function signer(event) {
  return await window.nostr.signEvent(event);
}

const pubkey = "266815e0c9210dfa324c6cba3573b14bee49da4209a9456f9484e5106cd408a5";
const server = "https://cdn.example.com";

const blobs = await listBlobs(server, pubkey, {
  onAuth: async () => createListAuth(signer),
});
```

### Iterate blob pages on a server

```js
import { iterateBlobs, createListAuth } from "blossom-client-sdk/actions";

async function signer(event) {
  return await window.nostr.signEvent(event);
}

const pubkey = "266815e0c9210dfa324c6cba3573b14bee49da4209a9456f9484e5106cd408a5";
const server = "https://cdn.example.com";

for await (const page of iterateBlobs(server, pubkey, {
  limit: 100,
  onAuth: async () => createListAuth(signer),
})) {
  console.log(page);
}
```

### Upload a single blob

```js
import { uploadBlob, createUploadAuth } from "blossom-client-sdk";

async function signer(event) {
  return await window.nostr.signEvent(event);
}

const server = "https://cdn.example.com";

const blob = await uploadBlob(server, new File(["testing"], "test.txt"), {
  onAuth: async (server, sha256, type) => createUploadAuth(signer, sha256, { type }),
});
```

### Upload a single blob to multiple servers

```js
import { uploadBlob, createUploadAuth } from "blossom-client-sdk";

async function signer(event) {
  return await window.nostr.signEvent(event);
}

const servers = ["https://cdn.example.com", "https://cdn.other.com"];
const file = new File(["testing"], "test.txt");

const auth = await createUploadAuth(signer, file, { message: "Upload test.txt" });

for (let server of servers) {
  await uploadBlob(server, file, { auth });
}
```

### Uploading and mirroring to multiple servers

The `multiServerUpload` method can be used to upload a single blob to multiple servers

Example of uploading to each server one at time

```ts
import { multiServerUpload, createUploadAuth } from "blossom-client-sdk";

async function signer(event: any) {
  // @ts-expect-error
  return await window.nostr.signEvent(event);
}

const servers = ["https://cdn.server-a.com", "https://cdn.example.com", "https://cdn.other.com"];
const file = new File(["testing"], "test.txt");

// create async generator for upload
const results = await multiServerUpload(servers, file, {
  onAuth: async (server, sha256, type) => createUploadAuth(signer, sha256, { type }),
  onUpload: (server, blob) => {},
  onError: (server, blob, error) => {
    console.log("Failed to upload to", server);
    console.log(error);
  },
});
```

### Uploading media and mirroring

The `multiServerUpload` method can also be used to upload media blobs and mirror them

```ts
import { multiServerUpload, createUploadAuth } from "blossom-client-sdk";

async function signer(event: any) {
  // @ts-expect-error
  return await window.nostr.signEvent(event);
}

const servers = ["https://cdn.server-a.com", "https://cdn.example.com", "https://cdn.other.com"];
const media = new File(["image data"], "image.png");

// create async generator for upload
const results = await multiServerUpload(servers, media, {
  // use media upload endpoint
  isMedia: true,
  // use any servers media endpoint
  mediaUploadBehavior: "any",
  // if the media endpoint isn't found fallback to the /upload endpoint
  mediaUploadFallback: true,
  // handle auth requests
  onAuth: async (server, sha256, type) => createUploadAuth(signer, sha256, { type }),
  onError: (server, blob, error) => {
    console.log("Failed to upload to", server);
    console.log(error);
  },
});
```

### Upload and Mirror manually

```js
import { uploadBlob, mirrorBlob, createUploadAuth } from "blossom-client-sdk";

async function signer(event) {
  return await window.nostr.signEvent(event);
}

const mainServer = "https://cdn.server-a.com";
const mirrorServers = ["https://cdn.example.com", "https://cdn.other.com"];
const file = new File(["testing"], "test.txt");

const auth = await createUploadAuth(signer, file, { message: "Upload test.txt" });

// first upload blob to main server
const blob = await uploadBlob(mainServer, file, { auth });

// then tell mirror servers to download it
for (let server of mirrorServers) {
  await mirrorBlob(server, blob, { auth });
}
```

### Check if a blob exists

```js
import { hasBlob } from "blossom-client-sdk/actions/has";

const exists = await hasBlob(
  "https://cdn.example.com",
  "b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553",
);
```

### Blossom URIs (BUD-10)

Parse and build `blossom:` URIs for referencing blobs across servers

```js
import { parseBlossomURI, buildBlossomURI, blossomURIToURL, blossomURIFromURL } from "blossom-client-sdk";

// parse a blossom URI
const parsed = parseBlossomURI(
  "blossom:b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553.pdf?xs=cdn.example.com&as=266815e0c9210dfa324c6cba3573b14bee49da4209a9456f9484e5106cd408a5&sz=1024",
);
// -> { sha256: "b167...", ext: "pdf", servers: ["cdn.example.com"], authors: ["2668..."], size: 1024 }

// build a blossom URI
const uri = buildBlossomURI({ sha256: "b167...", ext: "pdf", servers: ["cdn.example.com"], authors: [], size: 1024 });
// -> "blossom:b167....pdf?xs=cdn.example.com&sz=1024"

// convert to/from native URL objects
const url = blossomURIToURL(parsed);
const backToParsed = blossomURIFromURL(url);
```

### Resolve and download from a blossom URI

The `resolveBlob` function tries servers from the URI hints sequentially and returns the first successful response. Author hints are only resolved if server hints fail.

```js
import { resolveBlob } from "blossom-client-sdk/actions/resolve";
import { getServersFromServerListEvent, USER_BLOSSOM_SERVER_LIST_KIND } from "blossom-client-sdk";

const response = await resolveBlob("blossom:b167...4f553.pdf?xs=cdn.example.com&as=2668...08a5", {
  // resolve author pubkeys to server lists (only called if xs servers fail)
  getServers: async (pubkey) => {
    const event = await ndk.fetchEvent({ kinds: [USER_BLOSSOM_SERVER_LIST_KIND], authors: [pubkey] });
    return event ? getServersFromServerListEvent(event) : undefined;
  },
  // additional servers to try as a last resort
  fallbackServers: ["https://fallback.cdn.com"],
});

const blob = await response.blob();
```
