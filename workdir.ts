import { randomUUID } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep
} from "node:path";

const ENTRY_TYPE = "qni-tool-temporary-workdir";
const TEMPORARY_WORKDIR_PREFIX = "qni-cli-pi-";
const TEMPORARY_WORKDIR_MARKER = ".qni-pi-workdir";

type SessionEntry = {
  type?: unknown;
  customType?: unknown;
  data?: { token?: unknown; workdir?: unknown };
};

function isInside(root: string, target: string): boolean {
  const pathFromRoot = relative(root, target);
  return pathFromRoot === "" || (
    pathFromRoot !== ".."
    && !pathFromRoot.startsWith(`..${sep}`)
    && !isAbsolute(pathFromRoot)
  );
}

function existingDirectory(path: string): string {
  const canonical = realpathSync(path);
  if (!statSync(canonical).isDirectory()) {
    throw new Error("not a directory");
  }
  return canonical;
}

export class QniWorkdirs {
  private temporaryWorkdir: string | undefined;
  private readonly queues = new Map<string, Promise<void>>();

  constructor(private readonly appendEntry: (customType: string, data: unknown) => void) {}

  restore(entries: readonly unknown[], sessionReason: string): void {
    this.temporaryWorkdir = undefined;
    if (sessionReason === "new" || sessionReason === "fork") return;

    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index] as SessionEntry;
      if (entry.type !== "custom" || entry.customType !== ENTRY_TYPE) continue;
      const token = entry.data?.token;
      const workdir = entry.data?.workdir;
      if (typeof token === "string" && typeof workdir === "string") {
        const safeWorkdir = this.safeTemporaryWorkdir(workdir, token);
        if (safeWorkdir) {
          this.temporaryWorkdir = safeWorkdir;
        }
      }
      return;
    }
  }

  resolve(piWorkdir: string, requestedWorkdir: string | undefined): string {
    if (requestedWorkdir === undefined) return this.getTemporaryWorkdir();
    if (isAbsolute(requestedWorkdir)) {
      throw new Error("qni workdir must be relative to Pi's working directory");
    }

    try {
      const root = existingDirectory(piWorkdir);
      const target = existingDirectory(resolve(root, requestedWorkdir));
      if (!isInside(root, target)) {
        throw new Error("qni workdir must stay inside Pi's working directory");
      }
      return target;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("qni workdir")) throw error;
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`qni workdir is not an existing directory: ${requestedWorkdir} (${reason})`);
    }
  }

  async run<T>(workdir: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(workdir) ?? Promise.resolve();
    const running = previous.catch(() => undefined).then(operation);
    const tail = running.then(() => undefined, () => undefined);
    this.queues.set(workdir, tail);

    try {
      return await running;
    } finally {
      if (this.queues.get(workdir) === tail) this.queues.delete(workdir);
    }
  }

  cleanup(): void {
    if (this.temporaryWorkdir) {
      rmSync(this.temporaryWorkdir, { recursive: true, force: true });
      this.temporaryWorkdir = undefined;
    }
    this.queues.clear();
  }

  private getTemporaryWorkdir(): string {
    if (!this.temporaryWorkdir) {
      const token = randomUUID();
      const workdir = mkdtempSync(join(tmpdir(), TEMPORARY_WORKDIR_PREFIX));
      try {
        writeFileSync(
          join(workdir, TEMPORARY_WORKDIR_MARKER),
          token,
          { encoding: "utf8", mode: 0o600 }
        );
        this.appendEntry(ENTRY_TYPE, { token, workdir });
        this.temporaryWorkdir = workdir;
      } catch (error) {
        rmSync(workdir, { recursive: true, force: true });
        throw error;
      }
    }
    return this.temporaryWorkdir;
  }

  private safeTemporaryWorkdir(workdir: string, token: string): string | undefined {
    if (!isAbsolute(workdir)) return undefined;
    try {
      const temporaryRoot = existingDirectory(tmpdir());
      const canonical = existingDirectory(workdir);
      if (
        dirname(canonical) !== temporaryRoot
        || !basename(canonical).startsWith(TEMPORARY_WORKDIR_PREFIX)
        || readFileSync(join(canonical, TEMPORARY_WORKDIR_MARKER), "utf8") !== token
      ) {
        return undefined;
      }
      return canonical;
    } catch {
      return undefined;
    }
  }
}
