import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { basename } from "node:path";
import type { StudioMcpCommand } from "./studio-mcp.ts";

export interface JsonRpcSuccess<T = unknown> {
  jsonrpc: "2.0";
  id: number;
  result: T;
}

export interface JsonRpcFailure {
  jsonrpc: "2.0";
  id: number;
  error: { code: number; message: string; data?: unknown };
}

export type JsonRpcResponse<T = unknown> = JsonRpcSuccess<T> | JsonRpcFailure;

export interface OneShotMcpOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  onProcess?: (child: ChildProcessWithoutNullStreams) => void;
  onProcessExit?: (child: ChildProcessWithoutNullStreams) => void;
}

export interface OneShotMcpCall {
  method: string;
  params?: unknown;
}

export interface OneShotMcpResult<T = unknown> {
  response: JsonRpcSuccess<T>;
  stderr: string;
}

export interface OneShotMcpSequenceResult {
  responses: JsonRpcSuccess[];
  stderr: string;
}

interface PendingRequest {
  resolve: (response: JsonRpcResponse) => void;
  reject: (error: Error) => void;
}

const DEFAULT_TIMEOUT_MS = 5000;
const MCP_PROTOCOL_VERSION = "2024-11-05";
const CLIENT_INFO = { name: "pi-roblox-studio-tools", version: "0.2.0" } as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function resolveJsonRpcResponse(parsed: Record<string, unknown>): JsonRpcResponse | null {
  if ("error" in parsed && isRecord(parsed.error)) {
    return parsed as unknown as JsonRpcFailure;
  }
  if ("result" in parsed) {
    return parsed as unknown as JsonRpcSuccess;
  }
  return null;
}

function assertJsonRpcSuccess<R>(
  response: unknown,
  requestMethod: string,
): asserts response is JsonRpcSuccess<R> {
  if (!isRecord(response)) {
    throw new Error(`Invalid MCP response for ${requestMethod}: not an object`);
  }
  if (typeof response.id !== "number") {
    throw new Error(`Invalid MCP response for ${requestMethod}: id must be a number`);
  }
  if ("error" in response) {
    const error = response.error;
    if (!isRecord(error)) {
      throw new Error(`Invalid MCP response for ${requestMethod}: error must be an object`);
    }
    if (typeof error.code !== "number") {
      throw new Error(`Invalid MCP response for ${requestMethod}: error.code must be a number`);
    }
    if (typeof error.message !== "string") {
      throw new Error(`Invalid MCP response for ${requestMethod}: error.message must be a string`);
    }
    throw formatJsonRpcError(response as unknown as JsonRpcFailure);
  }
  if (!("result" in response)) {
    throw new Error(`Invalid MCP response for ${requestMethod}: missing result`);
  }
}

function makeSpawnCommand(command: StudioMcpCommand): { command: string; args: string[] } {
  if (process.platform !== "win32") return command;

  const fileName = basename(command.command).toLowerCase();
  if (!fileName.endsWith(".bat") && !fileName.endsWith(".cmd")) return command;

  return { command: "cmd.exe", args: ["/c", command.command, ...command.args] };
}

function writeMessage(child: ChildProcessWithoutNullStreams, message: unknown): void {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

function formatJsonRpcError(response: JsonRpcFailure): Error {
  return new Error(`MCP error ${response.error.code}: ${response.error.message}`);
}

export interface StudioMcpInitializeProbeResult {
  ok: boolean;
  serverInfo?: unknown;
  stderr: string;
  error?: string;
}

export async function probeStudioMcpInitialize(
  command: StudioMcpCommand,
  options: OneShotMcpOptions = {},
): Promise<StudioMcpInitializeProbeResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const spawnCommand = makeSpawnCommand(command);
  const child = spawn(spawnCommand.command, spawnCommand.args, {
    stdio: "pipe",
    windowsHide: true,
  });

  options.onProcess?.(child);

  let nextId = 1;
  let stdoutBuffer = "";
  let stderr = "";
  const pending = new Map<number, PendingRequest>();

  const cleanup = async (): Promise<void> => {
    options.onProcessExit?.(child);
    child.stdin.end();

    if (child.exitCode !== null || child.killed) return;

    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        if (child.exitCode === null && !child.killed) child.kill();
        resolve();
      }, 250);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  };

  const failAll = (error: Error): void => {
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  };

  child.stdout.on("data", (chunk: Buffer) => {
    stdoutBuffer += chunk.toString("utf8");

    while (true) {
      const newlineIndex = stdoutBuffer.indexOf("\n");
      if (newlineIndex === -1) break;

      const line = stdoutBuffer.slice(0, newlineIndex).trim();
      stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
      if (!line) continue;

      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        failAll(new Error(`Invalid MCP JSON line: ${line}`));
        continue;
      }

      if (!isRecord(parsed) || typeof parsed.id !== "number") continue;

      const request = pending.get(parsed.id);
      if (!request) continue;
      pending.delete(parsed.id);

      const response = resolveJsonRpcResponse(parsed);
      if (!response) {
        request.reject(new Error(`Invalid MCP JSON-RPC response (missing result or error): ${line}`));
        continue;
      }
      request.resolve(response);
    }
  });

  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8");
    if (stderr.length > 20_000) stderr = stderr.slice(-20_000);
  });

  child.on("error", (error) => failAll(error));
  child.on("exit", (code, signal) => {
    if (pending.size > 0) {
      failAll(new Error(`StudioMCP exited before response (code=${code ?? "null"}, signal=${signal ?? "null"}). ${stderr}`));
    }
  });

  const abort = (): void => {
    failAll(new Error("MCP request aborted"));
    if (child.exitCode === null && !child.killed) child.kill();
  };

  if (options.signal?.aborted) abort();
  options.signal?.addEventListener("abort", abort, { once: true });

  const sendRequest = async <R = unknown>(requestMethod: string, requestParams?: unknown): Promise<JsonRpcSuccess<R>> => {
    const id = nextId++;
    const responsePromise = new Promise<JsonRpcResponse<R>>((resolve, reject) => {
      pending.set(id, { resolve: resolve as (response: JsonRpcResponse) => void, reject });
    });

    writeMessage(child, { jsonrpc: "2.0", id, method: requestMethod, params: requestParams });

    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Timed out waiting for MCP ${requestMethod} after ${timeoutMs}ms`));
      }, timeoutMs);
      responsePromise.finally(() => clearTimeout(timer)).catch(() => clearTimeout(timer));
    });

    const response = await Promise.race([responsePromise, timeoutPromise]);
    assertJsonRpcSuccess<R>(response, requestMethod);
    return response;
  };

  try {
    const initializeResponse = await sendRequest("initialize", {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: CLIENT_INFO,
    });

    writeMessage(child, { jsonrpc: "2.0", method: "notifications/initialized" });

    const serverInfo = isRecord(initializeResponse.result) ? initializeResponse.result.serverInfo : undefined;
    return { ok: true, serverInfo, stderr };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, stderr, error: message };
  } finally {
    options.signal?.removeEventListener("abort", abort);
    await cleanup();
  }
}

export async function runOneShotMcpRequest<T = unknown>(
  command: StudioMcpCommand,
  method: string,
  params?: unknown,
  options: OneShotMcpOptions = {},
): Promise<OneShotMcpResult<T>> {
  const result = await runOneShotMcpRequests(command, [{ method, params }], options);
  const response = result.responses.at(-1);
  if (!response) throw new Error("MCP sequence completed without a response");
  return { response: response as JsonRpcSuccess<T>, stderr: result.stderr };
}

export async function runOneShotMcpRequests(
  command: StudioMcpCommand,
  calls: OneShotMcpCall[],
  options: OneShotMcpOptions = {},
): Promise<OneShotMcpSequenceResult> {
  if (calls.length === 0) throw new Error("At least one MCP request is required");

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const spawnCommand = makeSpawnCommand(command);
  const child = spawn(spawnCommand.command, spawnCommand.args, {
    stdio: "pipe",
    windowsHide: true,
  });

  options.onProcess?.(child);

  let nextId = 1;
  let stdoutBuffer = "";
  let stderr = "";
  const pending = new Map<number, PendingRequest>();

  const cleanup = async (): Promise<void> => {
    options.onProcessExit?.(child);
    child.stdin.end();

    if (child.exitCode !== null || child.killed) return;

    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        if (child.exitCode === null && !child.killed) child.kill();
        resolve();
      }, 250);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  };

  const failAll = (error: Error): void => {
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  };

  child.stdout.on("data", (chunk: Buffer) => {
    stdoutBuffer += chunk.toString("utf8");

    while (true) {
      const newlineIndex = stdoutBuffer.indexOf("\n");
      if (newlineIndex === -1) break;

      const line = stdoutBuffer.slice(0, newlineIndex).trim();
      stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
      if (!line) continue;

      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        failAll(new Error(`Invalid MCP JSON line: ${line}`));
        continue;
      }

      if (!isRecord(parsed) || typeof parsed.id !== "number") continue;

      const request = pending.get(parsed.id);
      if (!request) continue;
      pending.delete(parsed.id);

      const response = resolveJsonRpcResponse(parsed);
      if (!response) {
        request.reject(new Error(`Invalid MCP JSON-RPC response (missing result or error): ${line}`));
        continue;
      }
      request.resolve(response);
    }
  });

  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8");
    if (stderr.length > 20_000) stderr = stderr.slice(-20_000);
  });

  child.on("error", (error) => failAll(error));
  child.on("exit", (code, signal) => {
    if (pending.size > 0) {
      failAll(new Error(`StudioMCP exited before response (code=${code ?? "null"}, signal=${signal ?? "null"}). ${stderr}`));
    }
  });

  const abort = (): void => {
    failAll(new Error("MCP request aborted"));
    if (child.exitCode === null && !child.killed) child.kill();
  };

  if (options.signal?.aborted) abort();
  options.signal?.addEventListener("abort", abort, { once: true });

  const sendRequest = async <R = unknown>(requestMethod: string, requestParams?: unknown): Promise<JsonRpcSuccess<R>> => {
    const id = nextId++;
    const responsePromise = new Promise<JsonRpcResponse<R>>((resolve, reject) => {
      pending.set(id, { resolve: resolve as (response: JsonRpcResponse) => void, reject });
    });

    writeMessage(child, { jsonrpc: "2.0", id, method: requestMethod, params: requestParams });

    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Timed out waiting for MCP ${requestMethod} after ${timeoutMs}ms`));
      }, timeoutMs);
      responsePromise.finally(() => clearTimeout(timer)).catch(() => clearTimeout(timer));
    });

    const response = await Promise.race([responsePromise, timeoutPromise]);
    assertJsonRpcSuccess<R>(response, requestMethod);
    return response;
  };

  try {
    await sendRequest("initialize", {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: CLIENT_INFO,
    });

    writeMessage(child, { jsonrpc: "2.0", method: "notifications/initialized" });

    const responses: JsonRpcSuccess[] = [];
    for (const call of calls) {
      responses.push(await sendRequest(call.method, call.params));
    }

    return { responses, stderr };
  } finally {
    options.signal?.removeEventListener("abort", abort);
    await cleanup();
  }
}

export class StudioMcpProcessRegistry {
  private readonly children = new Set<ChildProcessWithoutNullStreams>();

  track(child: ChildProcessWithoutNullStreams): void {
    this.children.add(child);
  }

  untrack(child: ChildProcessWithoutNullStreams): void {
    this.children.delete(child);
  }

  killAll(): void {
    for (const child of this.children) {
      if (child.exitCode === null && !child.killed) child.kill();
    }
    this.children.clear();
  }
}