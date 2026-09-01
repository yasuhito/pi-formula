import type { TypesetImage } from "./typesetter";

interface ImageEntry {
  kind: "image";
  image: TypesetImage;
  bytes: number;
}

interface FailureEntry {
  kind: "failure";
  bytes: number;
}

type CacheEntry = ImageEntry | FailureEntry;

export interface RenderCacheStats {
  entries: number;
  bytes: number;
  lastFailure?: string;
}

export class RenderCache {
  private readonly entries = new Map<string, CacheEntry>();
  private bytes = 0;
  private lastFailure?: string;

  constructor(
    private readonly maxEntries: number,
    private readonly maxBytes = Number.MAX_SAFE_INTEGER,
  ) {
    if (
      !Number.isSafeInteger(maxEntries) ||
      maxEntries <= 0 ||
      !Number.isSafeInteger(maxBytes) ||
      maxBytes <= 0
    ) {
      throw new Error("RenderCache limits must be positive safe integers");
    }
  }

  getOrCreate(
    key: string,
    create: () => TypesetImage,
    accept: (image: TypesetImage) => boolean = () => true,
  ): TypesetImage | undefined {
    const cached = this.entries.get(key);
    if (cached) {
      this.touch(key, cached);
      return cached.kind === "image" ? cached.image : undefined;
    }

    try {
      const image = create();
      if (!accept(image)) {
        this.recordFailure(key, "image would be too small");
        return undefined;
      }
      const bytes =
        Buffer.byteLength(key) +
        Buffer.byteLength(image.svg) +
        image.png.byteLength;
      if (bytes > this.maxBytes) {
        this.recordFailure(key, "image exceeds cache byte limit");
        return undefined;
      }
      this.add(key, { kind: "image", image, bytes });
      return image;
    } catch {
      this.recordFailure(key, "typesetting failed");
      return undefined;
    }
  }

  hasFailure(key: string): boolean {
    const cached = this.entries.get(key);
    if (cached?.kind !== "failure") return false;
    this.touch(key, cached);
    return true;
  }

  recordFailure(key: string, reason: string): void {
    this.lastFailure = reason;
    this.remove(key);
    this.add(key, { kind: "failure", bytes: Buffer.byteLength(key) });
  }

  clear(): void {
    this.entries.clear();
    this.bytes = 0;
    this.lastFailure = undefined;
  }

  stats(): RenderCacheStats {
    return {
      entries: this.entries.size,
      bytes: this.bytes,
      ...(this.lastFailure ? { lastFailure: this.lastFailure } : {}),
    };
  }

  private touch(key: string, entry: CacheEntry): void {
    this.entries.delete(key);
    this.entries.set(key, entry);
  }

  private remove(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.entries.delete(key);
    this.bytes -= entry.bytes;
  }

  private add(key: string, entry: CacheEntry): void {
    this.entries.set(key, entry);
    this.bytes += entry.bytes;
    while (this.entries.size > this.maxEntries || this.bytes > this.maxBytes) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (oldestKey === undefined) break;
      this.remove(oldestKey);
    }
  }
}
