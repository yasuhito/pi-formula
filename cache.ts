export interface CachedImage {
  svg: string;
  png: Buffer;
}

interface SuccessfulEntry<T extends CachedImage> {
  kind: "image";
  value: T;
  bytes: number;
}

interface FailedEntry {
  kind: "failure";
  error: string;
  bytes: number;
}

type CacheEntry<T extends CachedImage> = SuccessfulEntry<T> | FailedEntry;

export interface RenderCacheStats {
  entries: number;
  bytes: number;
  lastFailure?: string;
}

function byteLength(value: CachedImage): number {
  return Buffer.byteLength(value.svg) + value.png.byteLength;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  try {
    return JSON.stringify(error) ?? String(error);
  } catch {
    return String(error);
  }
}

export class RenderCache<T extends CachedImage> {
  private readonly entries = new Map<string, CacheEntry<T>>();
  private bytes = 0;
  private latestFailure?: string;

  constructor(
    private readonly maxEntries: number,
    private readonly maxBytes: number
  ) {
    if (maxEntries < 1 || maxBytes < 1) {
      throw new Error("qni-math cache limits must be positive");
    }
  }

  getOrCreate(key: string, create: () => T): T | undefined {
    const cached = this.entries.get(key);
    if (cached) {
      this.touch(key, cached);
      return cached.kind === "image" ? cached.value : undefined;
    }

    try {
      const value = create();
      this.add(key, { kind: "image", value, bytes: byteLength(value) });
      return value;
    } catch (error) {
      this.recordFailure(key, error);
      return undefined;
    }
  }

  hasFailure(key: string): boolean {
    const entry = this.entries.get(key);
    if (entry?.kind !== "failure") return false;
    this.touch(key, entry);
    return true;
  }

  recordFailure(key: string, error: unknown): void {
    const message = errorMessage(error);
    this.latestFailure = message;
    const cached = this.entries.get(key);
    if (cached) {
      this.touch(key, cached);
      return;
    }
    this.add(key, {
      kind: "failure",
      error: message,
      bytes: Buffer.byteLength(key) + Buffer.byteLength(message)
    });
  }

  clear(): void {
    this.entries.clear();
    this.bytes = 0;
    this.latestFailure = undefined;
  }

  stats(): RenderCacheStats {
    return {
      entries: this.entries.size,
      bytes: this.bytes,
      ...(this.latestFailure === undefined ? {} : { lastFailure: this.latestFailure })
    };
  }

  private touch(key: string, entry: CacheEntry<T>): void {
    this.entries.delete(key);
    this.entries.set(key, entry);
  }

  private add(key: string, entry: CacheEntry<T>): void {
    this.entries.set(key, entry);
    this.bytes += entry.bytes;
    while (this.entries.size > this.maxEntries || this.bytes > this.maxBytes) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (oldestKey === undefined) break;
      const oldest = this.entries.get(oldestKey)!;
      this.entries.delete(oldestKey);
      this.bytes -= oldest.bytes;
    }
  }
}
