import { describe, expect, it, vi } from "vitest";
import {
  createBlossomHlsLoaders,
  type HlsFragmentLoaderContext,
  type HlsLoader,
  type HlsLoaderCallbacks,
  type HlsLoaderConfig,
  type HlsLoaderConfiguration,
  type HlsLoaderContext,
  type HlsLoaderResponse,
  type HlsLoaderStats,
  type HlsPlaylistLoaderContext,
} from "../src/hls.js";

type PlannedResult =
  | { type: "success"; data: string | ArrayBuffer; code?: number }
  | { type: "error"; code: number; text: string }
  | { type: "timeout" };

function createStats(): HlsLoaderStats {
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

function createFakeLoader(plan: Record<string, PlannedResult>, seenContexts: HlsLoaderContext[]) {
  return class FakeLoader<T extends HlsLoaderContext> implements HlsLoader<T> {
    public context: T | null = null;
    public stats = createStats();

    constructor(_config: HlsLoaderConfig) {}

    destroy() {}

    abort() {
      this.stats.aborted = true;
    }

    load(context: T, _config: HlsLoaderConfiguration, callbacks: HlsLoaderCallbacks<T>): void {
      this.context = context;
      seenContexts.push(context);

      const result = plan[context.url];
      if (!result) throw new Error(`Missing test plan for ${context.url}`);

      if (result.type === "success") {
        const response: HlsLoaderResponse = {
          url: context.url,
          data: result.data,
          code: result.code ?? 200,
        };
        callbacks.onSuccess(response, this.stats, context, { responseURL: context.url });
      } else if (result.type === "error") {
        callbacks.onError({ code: result.code, text: result.text }, context, { responseURL: context.url }, this.stats);
      } else {
        callbacks.onTimeout(this.stats, context, { responseURL: context.url });
      }
    }
  };
}

const playlistContext: HlsPlaylistLoaderContext = {
  url: "https://primary.example/video/master.m3u8?token=abc",
  responseType: "text",
  type: "manifest" as HlsPlaylistLoaderContext["type"],
  level: 0,
  id: null,
  deliveryDirectives: null,
  levelOrTrack: null,
};

const fragmentContext: HlsFragmentLoaderContext = {
  url: "https://primary.example/video/segment.ts?token=abc",
  responseType: "arraybuffer",
  frag: {} as HlsFragmentLoaderContext["frag"],
  part: null,
  headers: { Authorization: "Bearer test" },
  rangeStart: 100,
  rangeEnd: 200,
};

const loaderConfig: HlsLoaderConfiguration = {
  loadPolicy: {} as HlsLoaderConfiguration["loadPolicy"],
  timeout: 1000,
  maxRetry: 0,
  retryDelay: 0,
  maxRetryDelay: 0,
};

describe("createBlossomHlsLoaders", () => {
  it("falls back to the next server for playlists", async () => {
    const seenContexts: HlsLoaderContext[] = [];
    const onFallback = vi.fn();
    const { pLoader } = createBlossomHlsLoaders({
      fallbackServers: ["https://fallback.example"],
      onFallback,
    });

    const plan = {
      "https://primary.example/video/master.m3u8?token=abc": { type: "error", code: 404, text: "Not Found" },
      "https://fallback.example/video/master.m3u8?token=abc": { type: "success", data: "#EXTM3U" },
    } satisfies Record<string, PlannedResult>;

    const Loader = pLoader;
    const loader = new Loader({ loader: createFakeLoader(plan, seenContexts) } as HlsLoaderConfig);

    const result = await new Promise<{ response: HlsLoaderResponse; context: HlsPlaylistLoaderContext }>(
      (resolve, reject) => {
        loader.load(playlistContext, loaderConfig, {
          onSuccess: (response, _stats, context) => resolve({ response, context }),
          onError: reject,
          onTimeout: () => reject(new Error("unexpected timeout")),
        });
      },
    );

    expect(seenContexts.map((context) => context.url)).toEqual([
      "https://primary.example/video/master.m3u8?token=abc",
      "https://fallback.example/video/master.m3u8?token=abc",
    ]);
    expect(result.response.url).toBe("https://fallback.example/video/master.m3u8?token=abc");
    expect(result.context.url).toBe("https://fallback.example/video/master.m3u8?token=abc");
    expect(onFallback).toHaveBeenCalledWith({
      kind: "playlist",
      from: "https://primary.example",
      to: "https://fallback.example",
      url: "https://primary.example/video/master.m3u8?token=abc",
      attempt: 1,
    });
  });

  it("preserves fragment query strings, headers, and byte ranges during fallback", async () => {
    const seenContexts: HlsLoaderContext[] = [];
    const { fLoader } = createBlossomHlsLoaders({
      fallbackServers: ["fallback.example"],
    });

    const plan = {
      "https://primary.example/video/segment.ts?token=abc": { type: "error", code: 404, text: "Not Found" },
      "https://fallback.example/video/segment.ts?token=abc": { type: "success", data: new ArrayBuffer(8) },
    } satisfies Record<string, PlannedResult>;

    const Loader = fLoader;
    const loader = new Loader({ loader: createFakeLoader(plan, seenContexts) } as HlsLoaderConfig);

    await new Promise<void>((resolve, reject) => {
      loader.load(fragmentContext, loaderConfig, {
        onSuccess: () => resolve(),
        onError: reject,
        onTimeout: () => reject(new Error("unexpected timeout")),
      });
    });

    expect(seenContexts).toHaveLength(2);
    expect(seenContexts[1]).toMatchObject({
      url: "https://fallback.example/video/segment.ts?token=abc",
      headers: { Authorization: "Bearer test" },
      rangeStart: 100,
      rangeEnd: 200,
    });
  });

  it("prefers a healthy fallback server after a sticky failover", async () => {
    const seenContexts: HlsLoaderContext[] = [];
    const { pLoader } = createBlossomHlsLoaders({
      fallbackServers: ["https://fallback.example"],
      stickyFailover: true,
      penalizeMs: 60_000,
    });

    const plan = {
      "https://primary.example/video/master.m3u8?token=abc": { type: "error", code: 404, text: "Not Found" },
      "https://fallback.example/video/master.m3u8?token=abc": { type: "success", data: "#EXTM3U" },
      "https://fallback.example/video/next.m3u8?token=abc": { type: "success", data: "#EXTM3U" },
      "https://primary.example/video/next.m3u8?token=abc": { type: "success", data: "#EXTM3U" },
    } satisfies Record<string, PlannedResult>;

    const Loader = pLoader;
    const config = { loader: createFakeLoader(plan, seenContexts) } as HlsLoaderConfig;

    const firstLoader = new Loader(config);
    await new Promise<void>((resolve, reject) => {
      firstLoader.load(playlistContext, loaderConfig, {
        onSuccess: () => resolve(),
        onError: reject,
        onTimeout: () => reject(new Error("unexpected timeout")),
      });
    });

    const secondLoader = new Loader(config);
    await new Promise<void>((resolve, reject) => {
      secondLoader.load(
        { ...playlistContext, url: "https://primary.example/video/next.m3u8?token=abc" },
        loaderConfig,
        {
          onSuccess: () => resolve(),
          onError: reject,
          onTimeout: () => reject(new Error("unexpected timeout")),
        },
      );
    });

    expect(seenContexts.map((context) => context.url)).toEqual([
      "https://primary.example/video/master.m3u8?token=abc",
      "https://fallback.example/video/master.m3u8?token=abc",
      "https://fallback.example/video/next.m3u8?token=abc",
    ]);
  });

  it("does not retry non-retryable statuses by default", async () => {
    const seenContexts: HlsLoaderContext[] = [];
    const { pLoader } = createBlossomHlsLoaders({
      fallbackServers: ["https://fallback.example"],
    });

    const plan = {
      "https://primary.example/video/master.m3u8?token=abc": { type: "error", code: 403, text: "Forbidden" },
      "https://fallback.example/video/master.m3u8?token=abc": { type: "success", data: "#EXTM3U" },
    } satisfies Record<string, PlannedResult>;

    const Loader = pLoader;
    const loader = new Loader({ loader: createFakeLoader(plan, seenContexts) } as HlsLoaderConfig);

    const error = await new Promise<{ code: number; text: string }>((resolve) => {
      loader.load(playlistContext, loaderConfig, {
        onSuccess: () => {
          throw new Error("unexpected success");
        },
        onError: (error) => resolve(error),
        onTimeout: () => {
          throw new Error("unexpected timeout");
        },
      });
    });

    expect(error).toEqual({ code: 403, text: "Forbidden" });
    expect(seenContexts.map((context) => context.url)).toEqual(["https://primary.example/video/master.m3u8?token=abc"]);
  });
});
