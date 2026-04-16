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

### Media fallbacks

The SDK provides several methods for handling broken media elements (`<img>`, `<video>`, `<audio>`) by automatically trying alternative blossom servers. Both regular HTTP blob URLs and `blossom:` URIs are supported.

All the media fallback methods require a `getServers` callback to resolve pubkeys to server lists:

```js
import { USER_BLOSSOM_SERVER_LIST_KIND, getServersFromServerListEvent } from "blossom-client-sdk";

async function getServers(pubkey) {
  if (pubkey) {
    const event = await ndk.fetchEvent({ kinds: [USER_BLOSSOM_SERVER_LIST_KIND], authors: [pubkey] });
    if (event) return getServersFromServerListEvent(event);
  }
  return undefined;
}
```

#### Automatic fallbacks for a DOM tree

`handleBrokenMedia` watches a DOM tree for any `<img>`, `<video>`, or `<audio>` elements and automatically handles server fallbacks. It uses a `MutationObserver` to handle dynamically added elements. Returns a cleanup function to remove all listeners and stop observing.

```js
import { handleBrokenMedia } from "blossom-client-sdk";

// start watching for broken media in the document
const cleanup = handleBrokenMedia(document.body, getServers);

// later, to remove all listeners and stop watching
cleanup();
```

#### Blossom URIs in media elements

Media elements can use `blossom:` URIs directly in the `src` attribute. The fallback handler will automatically resolve the URI to HTTP URLs using the server hints:

```html
<img src="blossom:b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553.png?xs=https://cdn1.com&xs=https://cdn2.com" />
```

When the browser can't load the `blossom:` protocol, the error handler parses the URI, resolves server URLs from `xs` and `as` hints, and sets the first working URL.

#### Single element fallbacks

`handleMediaFallbacks` attaches an error listener to a single element. For regular HTTP URLs, it extracts the blob hash and looks up alternative servers using a `data-pubkey` attribute on the element or its parents:

```js
import { handleMediaFallbacks } from "blossom-client-sdk";

const video = document.createElement("video");
video.src = "https://cdn.example.com/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553.mp4";
video.dataset.pubkey = event.pubkey;

const removeListener = handleMediaFallbacks(video, getServers);
```

#### Get blob URLs without fetching

`getBlobUrls` returns an ordered list of URLs for a blob from a blossom URI without fetching anything. Useful for building custom UI or populating `<source>` elements:

```js
import { Actions } from "blossom-client-sdk";

const urls = await Actions.getBlobUrls("blossom:b167...4f553.mp4?xs=https://cdn1.com&xs=https://cdn2.com", {
  getServers,
  fallbackServers: ["https://fallback.cdn.com"],
});
// -> ["https://cdn1.com/b167...4f553.mp4", "https://cdn2.com/b167...4f553.mp4", "https://fallback.cdn.com/b167...4f553.mp4"]
```

#### Create `<source>` elements for video/audio

`createSourceElements` generates `<source>` elements from a URL list, giving the browser native fallback for `<video>` and `<audio>`:

```js
import { Actions, createSourceElements } from "blossom-client-sdk";

const urls = await Actions.getBlobUrls("blossom:b167...4f553.mp4?xs=https://cdn1.com&xs=https://cdn2.com");
const sources = createSourceElements(urls, "video/mp4");

const video = document.createElement("video");
video.append(...sources);
```

#### Resolve to an object URL

`resolveToObjectURL` fetches a blob with server fallback and returns a `blob:` object URL that works anywhere:

```js
import { Actions } from "blossom-client-sdk";

const objectUrl = await Actions.resolveToObjectURL("blossom:b167...4f553.png?xs=https://cdn1.com", { getServers });
image.src = objectUrl;
```

### HLS Video Streaming with Multi-Server Fallback

The SDK provides a loader factory for `hls.js` that automatically retries failed playlist and fragment requests across multiple Blossom servers. This enables resilient HLS playback even when some servers have missing or unavailable segments.

```ts
import Hls from "hls.js";
import { createBlossomHlsLoaders } from "blossom-client-sdk/hls";

// Create fallback loaders for hls.js
const { pLoader, fLoader } = createBlossomHlsLoaders({
  // Servers to try when the primary fails
  fallbackServers: ["https://cdn-backup1.example", "https://cdn-backup2.example"],
  // Penalize failed origins briefly to prefer healthy ones (default: false)
  stickyFailover: true,
  // How long to penalize failed servers in ms (default: 30000)
  penalizeMs: 30000,
  // HTTP status codes to retry (default: [404])
  retryStatuses: [404, 502, 503],
  // Callback when a fallback occurs
  onFallback: (info) => {
    console.log(`Falling back from ${info.from} to ${info.to} for ${info.kind}`);
    console.log(`Attempt ${info.attempt} for ${info.url}`);
  },
});

// Initialize hls.js with the fallback loaders
const hls = new Hls({
  pLoader,
  fLoader,
});

// Load a master playlist from any Blossom server
hls.loadSource("https://cdn.example.com/abc123def456.m3u8");
hls.attachMedia(videoElement);
```

**How it works:**

- The loaders keep the original playlist/fragment path and query string but swap the origin
- If the primary server returns a retryable error (404, 5xx, timeout), it automatically tries the next server
- With `stickyFailover` enabled, failed servers are briefly penalized so subsequent requests prefer healthy ones
- The loader preserves HTTP headers, byte-range requests, and response type

**Requirements:**

- `hls.js` must be installed as a peer dependency
- Blossom HLS playlists should use relative paths with SHA256 hashes as documented in the HLS formatting guide

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

The `multiServerUpload` method uploads a blob to the first server, then mirrors it to the remaining servers. It runs parallel preflight checks (`HEAD /<sha256>`) to detect which servers already have the blob, using `/mirror` to register ownership on those servers instead of re-uploading.

```ts
import { multiServerUpload, createUploadAuth } from "blossom-client-sdk";

async function signer(event: any) {
  // @ts-expect-error
  return await window.nostr.signEvent(event);
}

const servers = ["https://cdn.server-a.com", "https://cdn.example.com", "https://cdn.other.com"];
const file = new File(["testing"], "test.txt");

const results = await multiServerUpload(servers, file, {
  onAuth: async (server, sha256, type) => createUploadAuth(signer, sha256, { type }),
  onUpload: (server, sha256, blob) => {},
  onError: (server, sha256, blob, error) => {
    console.log("Failed to upload to", server);
    console.log(error);
  },
  // handle server rejections (413 too large, 415 unsupported type, etc.)
  onRejection: (server, sha256, blob, error) => {
    console.log(`Server ${server} rejected: ${error.code}`);
    return "skip"; // or "cancel" to abort entirely
  },
  // disable preflight checks if not needed (default: true)
  // preflight: false,
});
```

### Uploading media and mirroring

The `multiServerMediaUpload` method is designed for media files (images, videos) that should be optimized before distribution. It uploads the blob to a single server's BUD-05 `/media` endpoint for processing, then mirrors the optimized result to all other servers. The original unprocessed blob is never uploaded to other servers since the `/media` endpoint may transform it (resize, re-encode, etc.).

```ts
import { multiServerMediaUpload, createUploadAuth } from "blossom-client-sdk";

async function signer(event: any) {
  // @ts-expect-error
  return await window.nostr.signEvent(event);
}

const servers = ["https://cdn.server-a.com", "https://cdn.example.com", "https://cdn.other.com"];
const media = new File(["image data"], "image.png");

const results = await multiServerMediaUpload(servers, media, {
  // try any server's /media endpoint, not just the first (default: "first")
  mediaUploadBehavior: "any",
  // fall back to regular upload if no /media endpoint is found (default: false)
  mediaUploadFallback: true,
  onAuth: async (server, sha256, type) => createUploadAuth(signer, sha256, { type }),
  onError: (server, sha256, blob, error) => {
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
import { Actions } from "blossom-client-sdk";

const response = await Actions.resolveBlob("blossom:b167...4f553.pdf?xs=cdn.example.com&as=2668...08a5", {
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
