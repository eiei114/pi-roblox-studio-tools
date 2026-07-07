import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const defaultRoot = fileURLToPath(new URL("..", import.meta.url));
const root = process.argv[2] || process.env.PUBLISH_GUARD_ROOT || defaultRoot;
const workflowsDir = join(root, ".github", "workflows");

const bannedPatterns = [
  { label: "NPM_TOKEN", pattern: /NPM_TOKEN/i },
  { label: "NODE_AUTH_TOKEN", pattern: /NODE_AUTH_TOKEN/i },
];

let workflowFiles;
try {
  workflowFiles = readdirSync(workflowsDir).filter((file) =>
    file.endsWith(".yml") || file.endsWith(".yaml"),
  );
} catch {
  console.error(`publish:guard fail — missing workflow directory: ${workflowsDir}`);
  process.exit(1);
}

let failed = false;

for (const file of workflowFiles) {
  const content = readFileSync(join(workflowsDir, file), "utf8");
  for (const { label, pattern } of bannedPatterns) {
    if (pattern.test(content)) {
      console.error(
        `publish:guard fail — ${file} must not reference ${label}. Use npm Trusted Publishing (OIDC) instead.`,
      );
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log(
  `publish:guard ok — ${workflowFiles.length} workflow file(s) use OIDC Trusted Publishing only`,
);
