# 🌸 Blossom Client

A javascript client for manage blobs on blossom servers

## Example

```js
import { BlossomClient } from "blossom-client-sdk";

async function signer(event) {
  return await window.nostr.signEvent(event);
}

const client = new BlossomClient("https://cdn.example.com", signer);

const blobs = await client.listBlobs();

await client.uploadBlob(new File(["testing"], "test.txt"));
```
