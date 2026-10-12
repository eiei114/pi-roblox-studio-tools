import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  behaviorAssertions, EXTENSION_LOAD_ERROR_PATTERN, parseJsonLines, SDK_VERSIONS,
  UNHANDLED_ERROR_PATTERN, VERIFICATION_CONTRACT,
} from "./pi-sdk-smoke-contract.mjs";

const PROBE_TIMEOUT_MS = 15_000;
const CLEANUP_GRACE_MS = 1_000;
const root = resolve(import.meta.dirname, "..");
const reportPath = resolve(root, "docs/verification/pi-sdk-smoke.json");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const manifest = readJson(resolve(root, "package.json"));
const sdkVersions = Object.fromEntries(Object.keys(SDK_VERSIONS).map((name) => [
  name, readJson(resolve(root, "node_modules", name, "package.json")).version,
]));
for (const [name, version] of Object.entries(SDK_VERSIONS)) {
  if (manifest.devDependencies?.[name] !== version || sdkVersions[name] !== version) {
    throw new Error(`Smoke requires exact SDK dev/test pin ${name}@${version}; manifest=${manifest.devDependencies?.[name]}, installed=${sdkVersions[name]}`);
  }
}

const piManifest = readJson(resolve(root, "node_modules/@earendil-works/pi-coding-agent/package.json"));
const piCli = resolve(root, "node_modules/@earendil-works/pi-coding-agent", piManifest.bin.pi);
const agentDir = mkdtempSync(join(tmpdir(), "pi-sdk-smoke-agent-"));
const missingStudioDir = mkdtempSync(join(tmpdir(), "pi-sdk-smoke-studiomcp-"));
const baseEnv = { ...process.env, PI_CODING_AGENT_DIR: agentDir };
for (const name of ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY", "OPENROUTER_API_KEY"]) {
  delete baseEnv[name];
}

function rpcArgs() {
  return [piCli, "--offline", "--no-session", "--no-builtin-tools", "--no-skills", "--no-context-files",
    "--no-mcp", "--approve", "-e", ".", "--mode", "rpc"];
}

function runPiRpc({ name, requests, env = baseEnv, isComplete, previous_process }) {
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, rpcArgs(), { cwd: root, env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    const responses = [];
    let stdout = "";
    let stderr = "";
    let pendingLine = "";
    let requestIndex = 0;
    let timedOut = false;
    let cleanupTimedOut = false;
    let settled = false;
    const deadline = setTimeout(() => {
      timedOut = true;
      child.kill();
      cleanupTimer = setTimeout(() => {
        cleanupTimedOut = true;
        finish(null, null);
      }, CLEANUP_GRACE_MS);
    }, PROBE_TIMEOUT_MS);
    let cleanupTimer;

    function finish(code, signal) {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      clearTimeout(cleanupTimer);
      const fullOutput = `${stdout}${stderr}`;
      const extensionLoadErrors = EXTENSION_LOAD_ERROR_PATTERN.test(fullOutput);
      const unhandledErrors = UNHANDLED_ERROR_PATTERN.test(fullOutput);
      const exit_code = code ?? 1;
      const assertions = behaviorAssertions(name, { responses, fullOutput, exit_code,
        process_exited: code !== null, timed_out: timedOut, previous_process });
      resolveRun({ name, command: "npm run smoke:pi", exit_code, signal,
        process_exited: code !== null, timed_out: timedOut, cleanup_timed_out: cleanupTimedOut,
        extensionLoadErrors, unhandledErrors, assertions,
        passed: code === 0 && !timedOut && !cleanupTimedOut && !extensionLoadErrors && !unhandledErrors
          && assertions.every((item) => item.passed),
        evidence: `stdout:\n${stdout.slice(-6000)}\nstderr:\n${stderr.slice(-3000)}` });
    }

    function sendNextRequest() {
      if (requestIndex >= requests.length) return;
      child.stdin.write(`${JSON.stringify(requests[requestIndex++])}\n`);
    }

    function endInput() {
      if (child.stdin.destroyed || child.stdin.writableEnded) return;
      child.stdin.end();
    }

    child.on("error", () => finish(null, null));
    child.on("close", (code, signal) => finish(code, signal));
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      stdout += text;
      pendingLine += text;
      const lines = pendingLine.split(/\r?\n/);
      pendingLine = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try { responses.push(JSON.parse(line)); } catch { /* Preserve non-JSON output in evidence. */ }
      }

      if (requestIndex === 1 && requests.length > 1
        && responses.some((row) => row?.type === "response" && row.command === "get_commands")) {
        sendNextRequest();
      }
      if (isComplete(responses)) endInput();
    });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
    child.stdin.on("error", () => {});
    sendNextRequest();
  });
}

function runHostShell() {
  const expectedVersion = sdkVersions["@earendil-works/pi-coding-agent"];
  let result;
  if (process.platform === "win32") {
    const shell = join(process.env.SystemRoot ?? "C:/Windows", "System32/WindowsPowerShell/v1.0/powershell.exe");
    const quote = (value) => `'${value.replaceAll("'", "''")}'`;
    const command = `& ${quote(process.execPath)} ${quote(piCli)} --no-extensions --version; exit $LASTEXITCODE`;
    result = spawnSync(shell, ["-NoProfile", "-NonInteractive", "-Command", command], {
      cwd: root, env: baseEnv, encoding: "utf8", timeout: PROBE_TIMEOUT_MS, windowsHide: true,
    });
  } else {
    result = spawnSync("/bin/sh", ["-c", '"$1" "$2" --no-extensions --version', "pi-host-shell", process.execPath, piCli], {
      cwd: root, env: baseEnv, encoding: "utf8", timeout: PROBE_TIMEOUT_MS,
    });
  }
  const timedOut = result.error?.code === "ETIMEDOUT";
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const code = result.status;
  const fullOutput = `${stdout}${stderr}`;
  const assertions = behaviorAssertions("host_shell", { responses: [], fullOutput,
    exit_code: code ?? 1, process_exited: code !== null && !timedOut, timed_out: timedOut });
  return { name: "host_shell", command: "npm run smoke:pi", exit_code: code ?? 1,
    process_exited: code !== null && !timedOut, timed_out: timedOut, cleanup_timed_out: false,
    extensionLoadErrors: EXTENSION_LOAD_ERROR_PATTERN.test(fullOutput),
    unhandledErrors: UNHANDLED_ERROR_PATTERN.test(fullOutput), assertions,
    passed: code === 0 && !timedOut && assertions.every((item) => item.passed),
    evidence: `stdout:\n${stdout.slice(-6000)}\nstderr:\n${stderr.slice(-3000)}` };
}

function promptRequest(id) {
  return { id, type: "prompt", message: "/roblox-studio-mcp-status" };
}

function redactLocalPaths(value) {
  if (typeof value === "string") {
    return value.replaceAll(root, "<checkout>")
      .replaceAll(missingStudioDir, "<isolated-LOCALAPPDATA>")
      .replaceAll(missingStudioDir.replaceAll("\\", "\\\\"), "<isolated-LOCALAPPDATA>")
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<rpc-id>")
      .replace(/[A-Z]:\\Users\\[^\\]+\\AppData\\Local\\Roblox/g, "%LOCALAPPDATA%\\Roblox");
  }
  if (Array.isArray(value)) return value.map(redactLocalPaths);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactLocalPaths(item)]));
  }
  return value;
}

function responseComplete(responses) {
  const prompt = responses.find((row) => row?.type === "response" && row.command === "prompt");
  const notification = responses.find((row) => row?.type === "extension_ui_request" && row.method === "notify");
  return !!prompt && (!!notification || prompt.success !== true);
}

try {
  const extensionLoad = await runPiRpc({ name: "extension_load", requests: [{ type: "get_commands" }],
    isComplete: (responses) => responses.some((row) => row?.type === "response" && row.command === "get_commands") });
  const happyPath = await runPiRpc({ name: "happy_path", requests: [promptRequest("happy-path")], isComplete: responseComplete });
  const errorEnv = { ...baseEnv, LOCALAPPDATA: missingStudioDir };
  const errorPath = await runPiRpc({ name: "error_path", requests: [promptRequest("error-path")], env: errorEnv,
    isComplete: responseComplete });
  const firstReloadProcess = await runPiRpc({ name: "happy_path", requests: [
    { type: "get_commands" }, promptRequest("reload-first-process"),
  ], isComplete: responseComplete });
  const reloadCleanup = await runPiRpc({ name: "reload_cleanup", previous_process: {
    exit_code: firstReloadProcess.exit_code, process_exited: firstReloadProcess.process_exited,
    timed_out: firstReloadProcess.timed_out,
  }, requests: [
    { type: "get_commands" }, promptRequest("reload-cleanup"),
  ], isComplete: (responses) => responseComplete(responses)
    && responses.some((row) => row?.type === "response" && row.command === "get_commands") });
  reloadCleanup.extensionLoadErrors ||= firstReloadProcess.extensionLoadErrors;
  reloadCleanup.unhandledErrors ||= firstReloadProcess.unhandledErrors;
  reloadCleanup.passed &&= firstReloadProcess.passed;
  reloadCleanup.evidence = `first process:\n${firstReloadProcess.evidence}\nsecond (reloaded) process:\n${reloadCleanup.evidence}`;
  const hostShell = runHostShell();
  const cases = [extensionLoad, happyPath, errorPath, reloadCleanup, hostShell];
  const report = { schema_version: 1, verification_contract: VERIFICATION_CONTRACT, sdk_versions: sdkVersions,
    platform: process.platform, model_inference: "none; the real extension command is invoked directly over Pi RPC",
    evidence_redactions: "Captured output is retained; checkout and user-local Roblox paths are replaced with neutral placeholders.",
    unhandled_errors: cases.filter((item) => item.unhandledErrors).length,
    extension_load_errors: cases.filter((item) => item.extensionLoadErrors).length,
    cases: cases.map(({ signal, process_exited, timed_out, cleanup_timed_out, extensionLoadErrors,
      unhandledErrors, ...item }) => ({ ...item, assertions: item.assertions,
      evidence: `${item.evidence}\nprocess_exited=${process_exited}; timed_out=${timed_out}; cleanup_timed_out=${cleanup_timed_out}; signal=${signal ?? "none"}` })) };
  mkdirSync(dirname(reportPath), { recursive: true });
  const serialized = `${JSON.stringify(redactLocalPaths(report), null, 2)}\n`;
  const reportTempPath = `${reportPath}.tmp`;
  const { writeFileSync, renameSync } = await import("node:fs");
  writeFileSync(reportTempPath, serialized);
  renameSync(reportTempPath, reportPath);
  console.log(JSON.stringify({ verification_contract: VERIFICATION_CONTRACT, platform: process.platform,
    unhandled_errors: report.unhandled_errors, extension_load_errors: report.extension_load_errors,
    cases: cases.map((item) => ({ name: item.name, passed: item.passed, exit_code: item.exit_code,
      assertions: item.assertions.map((assertion) => ({ id: assertion.id, passed: assertion.passed })) })) }));
  if (cases.some((item) => !item.passed)) process.exitCode = 1;
} finally {
  rmSync(agentDir, { recursive: true, force: true });
  rmSync(missingStudioDir, { recursive: true, force: true });
}
