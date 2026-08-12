export type MaybePromise<T> = T | PromiseLike<T>;

export type ByteStream = AsyncIterable<Uint8Array>;

export interface HashtreeOperationOptions {
  readonly signal?: AbortSignal;
}

export type HashtreeCallback<Input, Output> = (input: Input) => MaybePromise<Output>;

/** Public Hashtree content protection modes. */
export type HashtreeMode = "plaintext" | "chk-v1";

/**
 * Mode selection for future stateful clients. Omitting `mode` selects
 * plaintext; encrypted operation must always be requested explicitly.
 */
export type HashtreeModeOptions = { readonly mode?: "plaintext" } | { readonly mode: "chk-v1" };

/** Public, capability-free progress metadata safe for routine observation. */
export interface HashtreePublicProgress {
  readonly operation: string;
  readonly processedBytes?: number;
  readonly totalBytes?: number;
  readonly ciphertextHash?: Uint8Array;
  readonly mode?: HashtreeMode;
}

/** Public, capability-free diagnostic metadata safe for routine observation. */
export interface HashtreeDiagnostic {
  readonly operation: string;
  readonly processedBytes?: number;
  readonly totalBytes?: number;
  readonly ciphertextHash?: Uint8Array;
  readonly mode?: HashtreeMode;
}
