import type {
  FragmentLoaderConstructor,
  FragmentLoaderContext as HlsFragmentLoaderContext,
  HlsConfig as HlsLoaderConfig,
  Loader as HlsLoader,
  LoaderCallbacks as HlsLoaderCallbacks,
  LoaderConfiguration as HlsLoaderConfiguration,
  LoaderContext as HlsLoaderContext,
  LoaderResponse as HlsLoaderResponse,
  LoaderStats as HlsLoaderStats,
  PlaylistLoaderConstructor,
  PlaylistLoaderContext as HlsPlaylistLoaderContext,
} from "hls.js";

export type {
  HlsFragmentLoaderContext,
  HlsLoader,
  HlsLoaderCallbacks,
  HlsLoaderConfig,
  HlsLoaderConfiguration,
  HlsLoaderContext,
  HlsLoaderResponse,
  HlsLoaderStats,
  HlsPlaylistLoaderContext,
};

export type BlossomHlsFallbackInfo = {
  kind: "playlist" | "fragment";
  from: string;
  to: string;
  url: string;
  attempt: number;
};

export type BlossomHlsLoaderOptions = {
  fallbackServers?: (string | URL)[];
  stickyFailover?: boolean;
  penalizeMs?: number;
  retryStatuses?: number[];
  onFallback?: (info: BlossomHlsFallbackInfo) => void;
};

const DEFAULT_PENALIZE_MS = 30_000;

function createEmptyStats(): HlsLoaderStats {
  return {
    aborted: false,
    loaded: 0,
    retry: 0,
    total: 0,
    chunkCount: 0,
    bwEstimate: 0,
    loading: { start: 0, first: 0, end: 0 },
    parsing: { start: 0, end: 0 },
    buffering: { start: 0, first: 0, end: 0 },
  };
}

function normalizeServer(server: string | URL): string {
  if (server instanceof URL) return server.origin;
  if (!server.includes("://")) return `https://${server}`;

  try {
    return new URL(server).origin;
  } catch {
    return `https://${server}`;
  }
}

function replaceUrlOrigin(url: string, origin: string): string {
  const next = new URL(url);
  const base = new URL(origin);

  next.protocol = base.protocol;
  next.host = base.host;

  return next.toString();
}

function shouldRetry(code: number, isTimeout: boolean, retryStatuses: Set<number>): boolean {
  return isTimeout || code === 0 || code >= 500 || retryStatuses.has(code);
}

export function createBlossomHlsLoaders(options: BlossomHlsLoaderOptions = {}): {
  pLoader: PlaylistLoaderConstructor;
  fLoader: FragmentLoaderConstructor;
} {
  const fallbackServers = options.fallbackServers?.map(normalizeServer) ?? [];
  const stickyFailover = options.stickyFailover ?? false;
  const penalizeMs = options.penalizeMs ?? DEFAULT_PENALIZE_MS;
  const retryStatuses = new Set(options.retryStatuses ?? [404]);
  const penalties = new Map<string, number>();

  function clearExpiredPenalties() {
    const now = Date.now();

    for (const [origin, expiry] of penalties) {
      if (expiry <= now) penalties.delete(origin);
    }
  }

  function penalize(origin: string) {
    if (!stickyFailover) return;
    penalties.set(origin, Date.now() + penalizeMs);
  }

  function reward(origin: string) {
    if (!stickyFailover) return;
    penalties.delete(origin);
  }

  function getCandidateOrigins(url: string): string[] {
    clearExpiredPenalties();

    const originalOrigin = new URL(url).origin;
    const seen = new Set<string>();
    const ordered = [originalOrigin, ...fallbackServers].filter((origin) => {
      if (seen.has(origin)) return false;
      seen.add(origin);
      return true;
    });

    if (!stickyFailover) return ordered;

    const healthy = ordered.filter((origin) => !penalties.has(origin));
    const penalizedOrigins = ordered.filter((origin) => penalties.has(origin));

    return healthy.length > 0 ? [...healthy, ...penalizedOrigins] : ordered;
  }

  function createLoaderClass<T extends HlsLoaderContext>(
    kind: BlossomHlsFallbackInfo["kind"],
  ): new (config: HlsLoaderConfig) => HlsLoader<T> {
    return class BlossomHlsLoader implements HlsLoader<T> {
      public context: T | null = null;
      public stats: HlsLoaderStats = createEmptyStats();
      private activeLoader: HlsLoader<T> | null = null;
      private destroyed = false;
      private aborted = false;

      constructor(private config: HlsLoaderConfig) {}

      destroy(): void {
        this.destroyed = true;
        this.activeLoader?.destroy();
        this.activeLoader = null;
        this.context = null;
      }

      abort(): void {
        this.aborted = true;
        this.activeLoader?.abort();
      }

      getCacheAge(): number | null {
        return this.activeLoader?.getCacheAge?.() ?? null;
      }

      getResponseHeader(name: string): string | null {
        return this.activeLoader?.getResponseHeader?.(name) ?? null;
      }

      load(context: T, loaderConfig: HlsLoaderConfiguration, callbacks: HlsLoaderCallbacks<T>): void {
        this.destroyed = false;
        this.aborted = false;

        const origins = getCandidateOrigins(context.url);
        const BaseLoader = this.config.loader as new (config: HlsLoaderConfig) => HlsLoader<T>;

        let attempt = 0;

        const startAttempt = () => {
          if (this.destroyed || this.aborted) return;

          const origin = origins[attempt];
          const attemptUrl = replaceUrlOrigin(context.url, origin);
          const attemptContext = { ...context, url: attemptUrl };
          const loader = new BaseLoader(this.config);

          this.activeLoader = loader;
          this.context = attemptContext;
          this.stats = loader.stats;

          loader.load(attemptContext, loaderConfig, {
            onSuccess: (response, stats, successContext, networkDetails) => {
              this.stats = stats;
              this.context = successContext;
              reward(new URL(successContext.url).origin);
              callbacks.onSuccess(response, stats, successContext, networkDetails);
            },
            onProgress: callbacks.onProgress,
            onAbort: callbacks.onAbort,
            onError: (error, errorContext, networkDetails, stats) => {
              this.stats = stats;
              this.context = errorContext;

              if (attempt < origins.length - 1 && shouldRetry(error.code, false, retryStatuses)) {
                const failedOrigin = new URL(errorContext.url).origin;
                const nextOrigin = origins[attempt + 1];

                penalize(failedOrigin);
                this.activeLoader?.destroy();
                this.activeLoader = null;
                options.onFallback?.({
                  kind,
                  from: failedOrigin,
                  to: nextOrigin,
                  url: errorContext.url,
                  attempt: attempt + 1,
                });
                attempt += 1;
                startAttempt();
                return;
              }

              callbacks.onError(error, errorContext, networkDetails, stats);
            },
            onTimeout: (stats, timeoutContext, networkDetails) => {
              this.stats = stats;
              this.context = timeoutContext;

              if (attempt < origins.length - 1 && shouldRetry(0, true, retryStatuses)) {
                const failedOrigin = new URL(timeoutContext.url).origin;
                const nextOrigin = origins[attempt + 1];

                penalize(failedOrigin);
                this.activeLoader?.destroy();
                this.activeLoader = null;
                options.onFallback?.({
                  kind,
                  from: failedOrigin,
                  to: nextOrigin,
                  url: timeoutContext.url,
                  attempt: attempt + 1,
                });
                attempt += 1;
                startAttempt();
                return;
              }

              callbacks.onTimeout(stats, timeoutContext, networkDetails);
            },
          });
        };

        startAttempt();
      }
    };
  }

  return {
    pLoader: createLoaderClass<HlsPlaylistLoaderContext>("playlist"),
    fLoader: createLoaderClass<HlsFragmentLoaderContext>("fragment"),
  };
}
