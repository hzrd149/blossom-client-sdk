export interface HashtreeErrorOptions extends ErrorOptions {
  readonly operation?: string;
  readonly path?: string;
}

export interface HashtreeBoundsErrorOptions extends HashtreeErrorOptions {
  readonly limit: number;
  readonly actual: number;
}

export class HashtreeError extends Error {
  readonly operation?: string;
  readonly path?: string;

  constructor(message: string, options: HashtreeErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = new.target.name;
    this.operation = options.operation;
    this.path = options.path;
  }
}

export class HashtreeValidationError extends HashtreeError {}

export class HashtreeIntegrityError extends HashtreeError {}

export class HashtreeBoundsError extends HashtreeError {
  readonly limit: number;
  readonly actual: number;

  constructor(message: string, options: HashtreeBoundsErrorOptions) {
    super(message, options);
    this.limit = options.limit;
    this.actual = options.actual;
  }
}

export class HashtreeConflictError extends HashtreeError {}

export class ImmutableTreeError extends HashtreeError {}

export class HashtreeCallbackError extends HashtreeError {}

export class HashtreeLifecycleError extends HashtreeError {}
