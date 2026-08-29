import {
  mkdtempSync,
  realpathSync,
  rmSync,
  statSync
} from "node:fs";
import { tmpdir } from "node:os";
import {
  basename,
  isAbsolute,
  join,
  relative,
  resolve,
  sep
} from "node:path";

const ENTRY_TYPE = "qni-tool-temporary-workdir";
const TEMPORARY_WORKDIR_PREFIX = "qni-cli-pi-";

type SessionEntry = {
  type?: unknown;
  customType?: unknown;
  data?: { workdir?: unknown };
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
      const workdir = entry.data?.workdir;
      if (typeof workdir === "string" && this.isSafeTemporaryWorkdir(workdir)) {
        this.temporaryWorkdir = existingDirectory(workdir);
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
      this.temporaryWorkdir = mkdtempSync(join(tmpdir(), TEMPORARY_WORKDIR_PREFIX));
      this.appendEntry(ENTRY_TYPE, { workdir: this.temporaryWorkdir });
    }
    return this.temporaryWorkdir;
  }

  private isSafeTemporaryWorkdir(workdir: string): boolean {
    if (!isAbsolute(workdir) || !basename(workdir).startsWith(TEMPORARY_WORKDIR_PREFIX)) {
      return false;
    }
    try {
      return isInside(existingDirectory(tmpdir()), existingDirectory(workdir));
    } catch {
      return false;
    }
  }
}
