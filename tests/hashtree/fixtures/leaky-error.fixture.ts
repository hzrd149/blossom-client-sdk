export function createLeakyError(secret: string): Error {
  return Object.assign(new Error("fixture leak"), { secret, nested: { secret } });
}
