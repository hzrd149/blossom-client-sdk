export type MaybePromise<T> = T | PromiseLike<T>;

export type ByteStream = AsyncIterable<Uint8Array>;

export interface HashtreeOperationOptions {
  readonly signal?: AbortSignal;
}

export type HashtreeCallback<Input, Output> = (input: Input) => MaybePromise<Output>;
