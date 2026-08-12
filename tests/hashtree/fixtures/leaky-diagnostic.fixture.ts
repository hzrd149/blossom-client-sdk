export function createLeakyDiagnostic(secretUri: string): object {
  return { operation: "upload", uri: secretUri };
}
