import Module from "node:module";

type ModuleLoad = (
  request: string,
  parent: Module | null | undefined,
  isMain: boolean | undefined,
) => unknown;
// Node's private hook is intentionally confined to the two isolated probe processes.
export const moduleLoader = Module as typeof Module & { _load: ModuleLoad };
if (typeof moduleLoader._load !== "function")
  throw new Error("Node Module._load hook is unavailable");
