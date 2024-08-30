import { BlobDescriptor, BlossomClient, ServerType, Signer, UploadType } from "./client.js";

/**
 * Creates an AsyncGenerator that can be used to upload a blob to multiple servers
 * @param servers A Set or Array of servers to upload to
 * @param file The blob to be uploaded
 * @param signer An async function used for signing nostr events
 * @returns The BlobDescriptor if successful
 */
export async function* multiServerUpload(servers: Iterable<ServerType>, file: UploadType, signer: Signer) {
  const auth = await BlossomClient.getUploadAuth(file, signer);

  let blob: BlobDescriptor | undefined = undefined;
  let total = Array.from(servers).length;
  let uploaded = 0;

  for (const server of servers) {
    if (blob) {
      // mirror blob to server
      try {
        let b = await BlossomClient.mirrorBlob(server, blob.url, auth);
        uploaded++;
        yield { blob: b, progress: uploaded / total, server };
      } catch (error) {
        // not all servers support mirroring, attempt to upload
        let b = await BlossomClient.uploadBlob(server, file, auth);
        uploaded++;
        yield { blob: b, progress: uploaded / total, server };
      }
    } else {
      // attempt initial upload
      blob = await BlossomClient.uploadBlob(server, file, auth);
      uploaded++;
      yield { blob, progress: uploaded / total, server };
    }
  }

  return blob;
}
