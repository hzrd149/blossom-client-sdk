export function createCleanError(): Error {
  return new Error("Hashtree content failed integrity verification");
}
