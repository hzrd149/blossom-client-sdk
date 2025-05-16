# blossom-client-sdk

## 4.1.0

### Minor Changes

- 64e0b8a: Extend `auth` option to allow for preemptively sending authorization or disabling authorization.

## 4.0.0

### Major Changes

- 70e7cd8: Update payment requests to use cashu-ts payment requests according to NUT-23

### Patch Changes

- 238b0e4: Fix `handleBrokenImages` not handling child `<img/>` elements
- 6077c99: Fix `listBlobs` action not including auth header
- 494eac7: Fix duplicate hashes when creating auth event

## 3.0.1

### Patch Changes

- 1296dab: Fix Content-Type header on mirror action

## 3.0.0

### Major Changes

- c3e12d0: Update `createDownloadAuth`, `createUploadAuth`, `createMirrorAuth`, `createMediaAuth`, `createListAuth`, and `createDeleteAuth` to use options instead of message and expiration arguments
- 9de5eed: Add `sha256` argument to `onAuth` and `onPayment` methods in `uploadBlob`, `multiServerUpload`, and `mirrorBlob` actions

### Minor Changes

- c3e12d0: Add `client.uploadMedia` method
- 41aaa6d: Add `timeout` to `mirror`, `upload`, `list`, `delete`, `download` actions
- 9de5eed: Add `uploadMedia` action
- 41aaa6d: Add `mirrorTimeout` to `multiServerUpload` action

### Patch Changes

- 10719c5: Fix `auth` not getting set on first request
- c3e12d0: Fix `client.deleteBlob` using incorrect auth type

## 2.1.1

### Patch Changes

- d06052a: Make `pubkey` optional in PaymentRequest
- d06052a: Bump @cashu/cashu-ts dependency

## 2.1.0

### Minor Changes

- 157af49: Handle servers that don't support HEAD /upload

### Patch Changes

- 157af49: Fix download, delete, and list authentication

## 2.0.0

### Major Changes

- 89050e5: Renamed `BlossomClient.getBlob` to `BlossomClient.downloadBlob`
- 89050e5: Removed `created` from `BlobDescriptor`
- 89050e5: Renamed `BlossomClient.getMirrorAuth` to `BlossomClient.createMirrorAuth`
- 89050e5: Updated `BlossomClient.mirrorBlob` to take `BlobDescriptor` instead of `hash, url`
- 89050e5: Renamed `BlossomClient.getListAuth` to `BlossomClient.createListAuth`
- 89050e5: Moved `multiServerUpload` to `blossom-client-sdk/actions`
- 89050e5: Renamed `BlossomClient.getUploadAuth` to `BlossomClient.createUploadAuth`
- 89050e5: Added `BlossomClient.payment` for handling payments

### Minor Changes

- 89050e5: Added support for `X-Reason` header on failed requests

## 1.1.1

### Patch Changes

- df84c52: Fix incorrect file hashes in nodejs

## 1.1.0

### Minor Changes

- Add support for multiple hashes when creating auth events

### Patch Changes

- Allow auth to be passed into multiServerUpload

## 1.0.1

### Patch Changes

- Add upload exports to package.json

## 1.0.0

### Major Changes

- 8350d95: Remove dependency on cross-fetch and require NodeJS >= 18 for native `fetch` API

### Minor Changes

- 383a13b: Add `multiServerUpload` method

## 0.9.1

### Patch Changes

- Add support for nodejs Buffer type

## 0.9.0

### Minor Changes

- 1a5342b: Add mirror blob methods
- 24f4e57: add "x" or "server" tag on get auth

## 0.8.0

### Minor Changes

- Add `handleBrokenImages` method for repairing any broken images in an app

## 0.7.0

### Minor Changes

- Include "x" tag with sha256 in upload auth

### Patch Changes

- Allow URL class for server

## 0.7.0

### Minor Changes

- e2e93f5: Add `handleImageFallbacks` method
