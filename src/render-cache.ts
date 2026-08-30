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

  constructor(private readonly maxEntries: number) {}

  getOrCreate(key: string, create: () => TypesetImage): TypesetImage | undefined {
    const cached = this.entries.get(key);
    if (cached) {
      this.touch(key, cached);
      return cached.kind === "image" ? cached.image : undefined;
    }

    try {
      const image = create();
      this.add(key, {
        kind: "image",
        image,
        bytes: Buffer.byteLength(image.svg) + image.png.byteLength
      });
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
    if (this.entries.has(key)) return;
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
      ...(this.lastFailure ? { lastFailure: this.lastFailure } : {})
    };
  }

  private touch(key: string, entry: CacheEntry): void {
    this.entries.delete(key);
    this.entries.set(key, entry);
  }

  private add(key: string, entry: CacheEntry): void {
    this.entries.set(key, entry);
    this.bytes += entry.bytes;
    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (oldestKey === undefined) break;
      const oldest = this.entries.get(oldestKey)!;
      this.entries.delete(oldestKey);
      this.bytes -= oldest.bytes;
    }
  }
}
