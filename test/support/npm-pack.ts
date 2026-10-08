import { isRecord, parseJson } from "./json-value.js";
export interface PackedPackage {
  filename: string;
  files?: Array<{ path: string }>;
}
export function packedPackage(
  value: unknown,
  name = "pi-formula",
): PackedPackage {
  const candidate: unknown = Array.isArray(value)
    ? value[0]
    : isRecord(value) && typeof value.filename !== "string"
      ? value[name]
      : value;
  if (!isRecord(candidate) || typeof candidate.filename !== "string")
    throw new TypeError("npm pack did not return a filename");
  if (candidate.files === undefined) return { filename: candidate.filename };
  if (!Array.isArray(candidate.files))
    throw new TypeError("Invalid npm pack file list");
  return {
    filename: candidate.filename,
    files: candidate.files.map((file: unknown) => {
      if (!isRecord(file) || typeof file.path !== "string")
        throw new TypeError("Invalid npm pack file entry");
      return { path: file.path };
    }),
  };
}
export function parsePackedPackage(
  source: string,
  name?: string,
): PackedPackage {
  return packedPackage(parseJson(source), name);
}
