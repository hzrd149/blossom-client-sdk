# External Integrations

**Analysis Date:** 2026-07-25

## APIs & External Services

**Blossom servers:**
- Blossom HTTP blob servers - primary external API used for upload, download, listing, mirroring, media processing, existence checks, reports, and URI resolution.
  - SDK/Client: native `fetch` through `fetchWithTimeout()` in `src/helpers/fetch.ts` plus action wrappers in `src/actions/*.ts`.
  - Auth: Nostr `Authorization: Nostr <base64url-event>` header produced by `encodeAuthorizationHeader()` in `src/auth.ts`; auth events use kind `24242` from `src/const.ts`.
  - Endpoints: `HEAD /upload` and `PUT /upload` in `src/actions/upload.ts`; `GET /<sha256>` in `src/actions/download.ts`; `DELETE /<sha256>` in `src/actions/delete.ts`; `HEAD /<sha256>` in `src/actions/has.ts`; `GET /list/<pubkey>` in `src/actions/list.ts`; `PUT /mirror` in `src/actions/mirror.ts`; `PUT /media` in `src/actions/media.ts`; `PUT /report` in `src/actions/report.ts`.
  - Server discovery/fallback: `blossom:` URI `xs` server hints and optional `getServers(pubkey)` callbacks are consumed by `src/actions/resolve.ts` and `src/media.ts`.

**Nostr ecosystem:**
- Nostr signing - auth and reports use Nostr-shaped events, but production code does not include a relay client.
  - SDK/Client: consumer-provided `Signer` function from `src/types.ts`; examples use `window.nostr.signEvent()` and NDK-style signers in `README.md`.
  - Auth: signed events with `kind: 24242` (`src/const.ts`) and tags such as `t`, `expiration`, `x`, and `server` built by `createAuthEvent()` in `src/auth.ts`.
- Nostr server list events - user Blossom server discovery supports kind `10063` events.
  - SDK/Client: `getServersFromServerListEvent()` in `src/nostr.ts` parses `server` tags; consumers fetch events externally (README example uses `ndk.fetchEvent`).
  - Auth: Not applicable; event fetching is delegated to the host application.
- NIP-56 reports - blob reports are signed Nostr kind `1984` events sent to Blossom servers.
  - SDK/Client: `reportBlobs()` in `src/actions/report.ts` validates an `x` tag and submits the signed event to `/report`.
  - Auth: Signed report event supplied by consumer; no additional SDK signing.

**Cashu payments:**
- Cashu/NUT-23 style payment challenge handling - Blossom servers can require payment via HTTP `402` and `X-Cashu` headers.
  - SDK/Client: optional peer `@cashu/cashu-ts` from `package.json`, dynamically imported in `src/helpers/cashu.ts` and action payment branches.
  - Auth: `X-Cashu` request/response header; `getPaymentRequestFromHeaders()` decodes server challenges and action `onPayment` hooks return `PaymentToken` values from `src/types.ts`.

**HLS playback:**
- hls.js - optional integration for resilient HLS playlist/fragment loading across multiple Blossom origins.
  - SDK/Client: `hls.js` optional peer dependency; `createBlossomHlsLoaders()` in `src/hls.ts` returns `pLoader` and `fLoader` classes for hls.js configuration.
  - Auth: Not handled by the HLS integration; it preserves hls.js loader behavior and swaps origins for fallback URLs.

## Data Storage

**Databases:**
- Not detected.
  - Connection: Not applicable; no database env vars or clients are present in `package.json` or `src/`.
  - Client: Not applicable.

**File Storage:**
- External Blossom servers only. The SDK uploads/mirrors blobs to consumer-provided server URLs in `src/actions/upload.ts`, `src/actions/mirror.ts`, `src/actions/media.ts`, and `src/actions/multi-server.ts`.
- Local filesystem storage is not used by runtime source in `src/`; build output is emitted to `lib/` by `tsconfig.json`.

**Caching:**
- In-memory only.
  - Blob SHA-256 hashes are cached on Blob/File/Buffer objects via `BlobHashSymbol` in `src/helpers/blob.ts`.
  - Reusable auth events are stored in caller-supplied or action-created `Set<SignedEvent>` collections in `src/auth.ts` and `src/actions/multi-server.ts`.
  - HLS sticky failover penalties are stored in an in-memory `Map` inside `createBlossomHlsLoaders()` in `src/hls.ts`.

## Authentication & Identity

**Auth Provider:**
- Custom Nostr event auth for Blossom protocol.
  - Implementation: `src/auth.ts` creates, encodes, validates, reuses, and expires signed kind `24242` auth events; action files attach `Authorization` headers after `401` challenges or when `auth` is preset.
  - Signing: Consumers provide `Signer` callbacks (`src/types.ts`) through `onAuth` options in files such as `src/actions/upload.ts`, `src/actions/download.ts`, `src/actions/list.ts`, `src/actions/mirror.ts`, `src/actions/delete.ts`, and `src/actions/media.ts`.
  - Identity: Public keys live on supplied signed events (`SignedEvent.pubkey` in `src/types.ts`); the SDK does not store users or sessions.

## Monitoring & Observability

**Error Tracking:**
- None detected.

**Logs:**
- Runtime library generally propagates errors or calls user callbacks; no logging framework is used.
- `src/media.ts` uses `console.warn()` when a broken media element cannot be associated with a pubkey.
- Multi-server and report actions expose `onError` callbacks in `src/actions/multi-server.ts` and `src/actions/report.ts` for host-app logging.

## CI/CD & Deployment

**Hosting:**
- npm package publishing is handled by `.github/workflows/version-or-publish.yml` using `changesets/action@v1` and `pnpm publish --no-git-checks`.
- API documentation is hosted on GitHub Pages; `.github/workflows/page.yml` builds TypeDoc docs and deploys `./docs` on version tags.

**CI Pipeline:**
- GitHub Actions.
  - `.github/workflows/test.yml` runs node Vitest on Node `18.x`, `20.x`, `22.x`, and `24.x`, plus a browser job on Node `22` with Playwright Chromium.
  - `.github/workflows/version-or-publish.yml` builds and publishes releases from `master` via Changesets.
  - `.github/workflows/page.yml` publishes generated docs to GitHub Pages.

## Environment Configuration

**Required env vars:**
- Runtime library: none detected in `src/`; server URLs, auth signers, and payment handlers are supplied as function parameters/options.
- CI release: `GITHUB_TOKEN`, `NPM_TOKEN`, and `NODE_AUTH_TOKEN` are referenced in `.github/workflows/version-or-publish.yml`.
- CI docs: GitHub Pages uses workflow permissions (`pages: write`, `id-token: write`) in `.github/workflows/page.yml`.

**Secrets location:**
- GitHub Actions repository/environment secrets for `NPM_TOKEN`; `GITHUB_TOKEN` is the GitHub-provided workflow token in `.github/workflows/version-or-publish.yml`.
- No `.env` files detected in the repository root.

## Webhooks & Callbacks

**Incoming:**
- None. This package is a client SDK and does not define server routes or webhook handlers.

**Outgoing:**
- Blossom server HTTP calls from `src/actions/*.ts` to `/upload`, `/<sha256>`, `/list/<pubkey>`, `/mirror`, `/media`, and `/report`.
- HLS playlist and fragment requests through hls.js loaders generated by `src/hls.ts`.
- Consumer callback contracts:
  - `onAuth` obtains signed Nostr auth events in `src/actions/upload.ts`, `src/actions/download.ts`, `src/actions/list.ts`, `src/actions/mirror.ts`, `src/actions/delete.ts`, `src/actions/media.ts`, and `src/actions/multi-server.ts`.
  - `onPayment` obtains Cashu payment tokens after `402` challenges in `src/actions/*.ts`.
  - `getServers` resolves Nostr pubkeys to Blossom servers in `src/actions/resolve.ts` and `src/media.ts`.
  - `onFallback` observes HLS fallback attempts in `src/hls.ts`.
  - `onError`, `onStart`, `onUpload`, and `onRejection` report multi-server orchestration outcomes in `src/actions/multi-server.ts`.

---

*Integration audit: 2026-07-25*
