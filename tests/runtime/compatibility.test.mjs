// node:test is supported natively by Node, Deno, and Bun. Exercise the published
// ESM entrypoints and real HTTP/Web APIs rather than running Vitest through Node.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createServer } from "node:http";
import {
  BlobHashSymbol,
  TimeoutError,
  computeBlobSha256,
  createAuthEvent,
  doesAuthMatchRequest,
  encodeAuthorizationHeader,
  fetchWithTimeout,
  getBlobSha256,
  getBlobSize,
  getBlobType,
} from "blossom-client-sdk";
import { uploadBlob } from "blossom-client-sdk/actions/upload";
import { downloadBlob } from "blossom-client-sdk/actions/download";

const content = "hello";
const hash = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";
// Signing is outside the SDK; use a deterministic signer to test event handling.
const signer = async (draft) => ({ ...draft, id: "0".repeat(64), pubkey: "1".repeat(64), sig: "2".repeat(128) });

async function withServer(handler, run) {
  const server = createServer((request, response) => {
    Promise.resolve(handler(request, response)).catch(() => {
      response.writeHead(500);
      response.end();
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
  }
}

test("hashes native Blob, File, and Buffer values and caches the result", async () => {
  for (const value of [new Blob([content]), new File([content], "hello.txt"), Buffer.from(content)]) {
    assert.equal(await computeBlobSha256(value), hash);
    assert.equal(await getBlobSha256(value), hash);
    assert.equal(value[BlobHashSymbol], hash);
    assert.equal(getBlobSize(value), 5);
  }
  const file = new File([content], "hello.txt", { type: "text/plain" });
  // Bun may add a charset to text files; the SDK should preserve the native type.
  assert.equal(getBlobType(file), file.type);
  assert.match(file.type, /^text\/plain(?:;|$)/);
  assert.equal(
    await computeBlobSha256(new Blob([])),
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
});

test("encodes Unicode auth and matches native URL and Blob inputs", async () => {
  const event = await createAuthEvent(signer, "upload", {
    blobs: new Blob([content]),
    servers: ["https://EXAMPLE.com/path"],
    message: "Upload 🌸",
  });
  const encoded = encodeAuthorizationHeader(event);
  assert.match(encoded, /^Nostr [A-Za-z0-9_-]+$/);
  assert.deepEqual(JSON.parse(Buffer.from(encoded.slice(6), "base64url").toString("utf8")), event);
  assert.equal(
    await doesAuthMatchRequest(event, {
      server: new URL("https://example.com"),
      type: "upload",
      blob: new Blob([content]),
    }),
    true,
  );
  assert.equal(await doesAuthMatchRequest(event, { server: "https://other.com", type: "upload", blob: hash }), false);
});

test("uploads native File bodies after an auth challenge and downloads native Responses", async () => {
  const requests = [];
  const bodies = [];
  const authHeaders = [];
  await withServer(
    async (request, response) => {
      requests.push(`${request.method} ${request.url}`);
      if (request.method === "HEAD") {
        response.writeHead(401);
      } else if (request.method === "PUT") {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        bodies.push(Buffer.concat(chunks).toString());
        authHeaders.push(request.headers.authorization);
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({ sha256: hash, size: 5, type: "text/plain", url: `/${hash}`, uploaded: 1 }));
        return;
      } else {
        response.setHeader("Content-Type", "text/plain");
        response.end(content);
        return;
      }
      response.end();
    },
    async (server) => {
      const auth = await createAuthEvent(signer, "upload", { blobs: hash });
      const descriptor = await uploadBlob(new URL(server), new File([content], "hello.txt", { type: "text/plain" }), {
        onAuth: async () => auth,
      });
      assert.equal(descriptor.sha256, hash);
      const response = await downloadBlob(server, hash);
      assert.ok(response instanceof Response);
      assert.equal(response.headers.get("content-type"), "text/plain");
      assert.equal(await response.text(), content);
      assert.deepEqual(authHeaders, [encodeAuthorizationHeader(auth)]);
    },
  );
  assert.deepEqual(bodies, [content]);
  assert.deepEqual(requests, ["HEAD /upload", "PUT /upload", `GET /${hash}`]);
});

test("retries payment challenges using native Headers", async () => {
  const payments = [];
  await withServer(
    (request, response) => {
      payments.push(request.headers["x-payment"]);
      if (!request.headers["x-payment"]) {
        response.writeHead(402, { "X-Payment-Request": "test-invoice" });
        response.end();
      } else response.end(content);
    },
    async (server) => {
      const response = await downloadBlob(server, hash, {
        onPaymentRequired: async (_, requestedHash, headers) => {
          assert.equal(requestedHash, hash);
          assert.equal(headers.get("X-Payment-Request"), "test-invoice");
          return new Headers({ "X-Payment": "test-token" });
        },
      });
      assert.equal(await response.text(), content);
    },
  );
  assert.deepEqual(payments, [undefined, "test-token"]);
});

test("cancels real fetch requests on timeout and caller abort", async () => {
  await withServer(
    () => {},
    async (server) => {
      await assert.rejects(fetchWithTimeout(server, { timeout: 30 }), TimeoutError);
      const controller = new AbortController();
      const request = fetchWithTimeout(server, { signal: controller.signal, timeout: 5000 });
      controller.abort();
      await assert.rejects(request);
    },
  );
});
