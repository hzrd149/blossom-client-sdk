/** returns the last sha256 in a URL */
export function getHashFromURL(url: string | URL) {
  if (typeof url === "string") url = new URL(url);

  const hashes = Array.from(url.pathname.matchAll(/[0-9a-f]{64}/gi));
  if (hashes.length > 0) return hashes[hashes.length - 1][0];

  return null;
}

export function readFileAsArrayBuffer(file: Blob | File) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (result == undefined || typeof result !== "object") {
        reject();
        return;
      }

      resolve(result);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}
