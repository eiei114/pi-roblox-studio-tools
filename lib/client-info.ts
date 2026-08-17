import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let cachedClientInfo: { name: string; version: string } | undefined;

export function getClientInfo(): { name: string; version: string } {
  if (!cachedClientInfo) {
    const pkgPath = join(PACKAGE_ROOT, "package.json");
    const raw = readFileSync(pkgPath, "utf8");
    const pkg = JSON.parse(raw) as { version?: unknown };
    if (typeof pkg.version !== "string" || pkg.version.trim().length === 0) {
      throw new Error("package.json is missing a valid version field");
    }
    cachedClientInfo = { name: "pi-roblox-studio-tools", version: pkg.version };
  }
  return cachedClientInfo;
}
