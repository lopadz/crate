export function basename(path: string): string {
  return path.replace(/\/$/, "").split("/").pop() ?? path;
}
