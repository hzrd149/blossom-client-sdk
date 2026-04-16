# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

blossom-client-sdk is a TypeScript client SDK for managing blobs on [Blossom](https://github.com/hzrd149/blossom) servers. It uses Nostr-based authorization (kind 24242 events) and supports Cashu payments. Published as an ES module (`"type": "module"`).

## Commands

- **Build:** `pnpm build` (runs `tsc`, outputs to `lib/`)
- **Test:** `pnpm test` (vitest, node environment)
- **Single test:** `pnpm vitest run tests/auth.test.ts`
- **Browser tests:** `pnpm vitest run --browser --browser.headless`
- **Coverage:** `pnpm coverage`
- **Format:** `pnpm format` (prettier)
- **Docs:** `pnpm docs` (typedoc)

Package manager is **pnpm** (10.10.0). Node >=18.

## Architecture

### Module Structure

The SDK exposes multiple entry points via package.json `exports`:

- `blossom-client-sdk` — main barrel export (`src/index.ts`)
- `blossom-client-sdk/client` — `BlossomClient` class
- `blossom-client-sdk/auth` — auth event creation functions
- `blossom-client-sdk/actions` — low-level action functions
- `blossom-client-sdk/actions/*` — individual actions (upload, download, list, delete, mirror, media, multi-server)
- `blossom-client-sdk/helpers` — utility functions (blob hashing, fetch, URL, signals)
- `blossom-client-sdk/image` — DOM image fallback handling
- `blossom-client-sdk/nostr` — nostr server list constants

### Two API Layers

1. **Action functions** (`src/actions/`): Stateless functions that each take a server, payload, and options object. These are the building blocks. Each action handles its own auth negotiation (retry with auth on 401) and payment flow (retry with payment on 402).

2. **BlossomClient class** (`src/client.ts`): Wraps action functions with a bound server and signer. Exposes both static methods (delegating directly to actions/auth) and instance methods that auto-attach auth and payment handlers from the instance.

### Auth System

`src/auth.ts` creates Nostr kind-24242 signed events. The `Signer` type (`(draft: EventTemplate) => Promise<SignedEvent>`) is the key integration point — consumers provide their own signing implementation (NIP-07 window.nostr, NDK, etc.). Auth events include `t` (action type), `x` (sha256), and `expiration` tags.

### Payment Flow

Actions support a 402 payment flow: server returns a `PaymentRequest` (Cashu NUT-23), the `onPayment` callback processes it and returns a `PaymentToken`, then the request is retried with a `Payment` header.

### Multi-Server Orchestration

`src/actions/multi-server.ts` handles uploading to multiple servers with media upload optimization (BUD-05), auth event reuse across servers, and partial failure callbacks.

## Testing

Tests are in `tests/` mirroring `src/` structure. Uses `vitest-fetch-mock` for HTTP mocking and `nostr-tools` for key generation in tests. Some tests use `.skipIf()` to separate browser-only and node-only tests.

## Versioning

Uses [changesets](https://github.com/changesets/changesets). Base branch is `master`. Run `pnpm changeset` to create a changeset for new changes.
