import type Module from "node:module";

type ModuleLoad = (
  request: string,
  parent: Module | null | undefined,
  isMain: boolean | undefined,
) => unknown;
export type ModuleLoader = typeof Module & { _load: ModuleLoad };
