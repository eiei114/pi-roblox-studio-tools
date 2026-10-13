export const VERIFICATION_CONTRACT = "pi-sdk-behavior-v2";
export const SDK_VERSIONS = {
  "@earendil-works/pi-agent-core": "1.1.0",
  "@earendil-works/pi-ai": "1.1.0",
  "@earendil-works/pi-coding-agent": "1.1.0",
  "@earendil-works/pi-tui": "1.1.0",
};
export const UNHANDLED_ERROR_PATTERN = /UnhandledPromiseRejection|uncaught exception|shutdown error/i;
export const EXTENSION_LOAD_ERROR_PATTERN = /Failed to load extension|Error loading extension/i;

const windowsSeparator = String.raw`[/\\]{1,4}`;
const windowsUserName = String.raw`[^/\\]+`;
const windowsUserProfilePattern = new RegExp(`[A-Z]:${windowsSeparator}Users${windowsSeparator}${windowsUserName}`, "i");
const robloxPathPattern = new RegExp(`[A-Z]:${windowsSeparator}Users${windowsSeparator}${windowsUserName}${windowsSeparator}AppData${windowsSeparator}Local${windowsSeparator}Roblox`, "gi");
const unixUserProfilePattern = /\/(?:home|Users)\/[^/\\\s"<>]+/i;
const rpcIdPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

function localPathForms(path) {
  const variants = new Set([path, path.replaceAll("\\", "/"), path.replaceAll("/", "\\")]);
  const forms = new Set();
  for (let form of variants) {
    for (let depth = 0; depth < 4; depth += 1) {
      forms.add(form);
      form = form.replaceAll("\\", "\\\\");
    }
  }
  return forms;
}

export function redactLocalPaths(value, localPaths = []) {
  if (typeof value === "string") {
    let redacted = value.replace(robloxPathPattern, "%LOCALAPPDATA%\\Roblox");
    for (const { path, replacement } of [...localPaths]
      .filter(({ path, replacement }) => typeof path === "string" && path && replacement)
      .sort((left, right) => right.path.length - left.path.length)) {
      for (const form of localPathForms(path)) redacted = redacted.replaceAll(form, replacement);
    }
    return redacted.replace(rpcIdPattern, "<rpc-id>")
      .replaceAll(new RegExp(windowsUserProfilePattern.source, "gi"), "<user-profile>")
      .replaceAll(new RegExp(unixUserProfilePattern.source, "gi"), "<user-profile>");
  }
  if (Array.isArray(value)) return value.map((item) => redactLocalPaths(item, localPaths));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactLocalPaths(item, localPaths)]));
  }
  return value;
}

export function containsUnredactedLocalPaths(value, localPaths = []) {
  if (typeof value === "string") {
    return localPaths.some(({ path }) => typeof path === "string" && path
      && [...localPathForms(path)].some((form) => value.includes(form)))
      || windowsUserProfilePattern.test(value) || unixUserProfilePattern.test(value);
  }
  if (Array.isArray(value)) return value.some((item) => containsUnredactedLocalPaths(item, localPaths));
  if (value && typeof value === "object") {
    return Object.values(value).some((item) => containsUnredactedLocalPaths(item, localPaths));
  }
  return false;
}

export function parseJsonLines(output) {
  return output.split(/\r?\n/).flatMap((line) => {
    if (!line.trim()) return [];
    try { return [JSON.parse(line)]; } catch { return []; }
  });
}

function assertion(id, expected, observed, passed) {
  return { id, expected, observed: JSON.stringify(observed), passed: passed === true };
}

function extensionRegistration(responses) {
  const response = responses.find((row) => row?.type === "response" && row.command === "get_commands");
  const command = response?.data?.commands?.find((item) =>
    item.name === "roblox-studio-mcp-status" && item.source === "extension");
  return { response: response ?? null, command: command ?? null, passed: response?.success === true && !!command };
}

function statusNotification(responses) {
  const prompt = responses.find((row) => row?.type === "response" && row.command === "prompt");
  const notification = responses.find((row) => row?.type === "extension_ui_request" && row.method === "notify"
    && typeof row.message === "string");
  const readiness = /^readiness: (.+)$/m.exec(notification?.message ?? "")?.[1];
  const platform = /^platform: (.+)$/m.exec(notification?.message ?? "")?.[1];
  return { prompt: prompt ?? null, notification: notification ?? null, readiness: readiness ?? null,
    platform: platform ?? null };
}

export function behaviorAssertions(name, { responses, fullOutput, exit_code, process_exited, timed_out, previous_process }) {
  if (name === "extension_load") {
    const registered = extensionRegistration(responses);
    return [assertion("extension_registered", "The actual Pi host registers /roblox-studio-mcp-status as an extension command",
      registered, registered.passed)];
  }

  if (name === "happy_path") {
    const status = statusNotification(responses);
    const message = status.notification?.message ?? "";
    const fieldsPresent = ["supported:", "found:", "callable:", "readiness:", "platform:"].every((field) => message.includes(field));
    const promptHandled = status.prompt?.success === true && status.prompt?.data?.disposition === "handled";
    return [assertion("feature_response", "Pi handles the real status command and returns supported/readiness fields",
      status, promptHandled && fieldsPresent && !!status.platform && !!status.readiness)];
  }

  if (name === "error_path") {
    const status = statusNotification(responses);
    const negativeReadiness = status.readiness === "not_found" || status.readiness === "unsupported";
    const handledWarning = status.notification?.notifyType === "warning"
      && status.prompt?.success === true && status.prompt?.data?.disposition === "handled";
    return [assertion("handled_error", "An isolated missing/unsupported StudioMCP host returns a handled warning with negative readiness",
      status, handledWarning && negativeReadiness)];
  }

  if (name === "reload_cleanup") {
    const registered = extensionRegistration(responses);
    const status = statusNotification(responses);
    const message = status.notification?.message ?? "";
    const featureResponse = status.prompt?.success === true && status.prompt?.data?.disposition === "handled"
      && ["supported:", "found:", "callable:", "readiness:", "platform:"].every((field) => message.includes(field));
    const previousProcessClean = previous_process?.exit_code === 0 && previous_process.process_exited === true
      && previous_process.timed_out !== true;
    return [
      assertion("reloaded_extension_registered", "A second real Pi process registers the package status command",
        registered, registered.passed),
      assertion("reloaded_feature_response", "The second process handles the actual status command and returns its fields",
        status, featureResponse),
      assertion("clean_shutdown", "Both original and reloaded Pi processes exit naturally with no unhandled or shutdown errors",
        { previous_process: previous_process ?? null, exit_code, process_exited, timed_out,
          errors: UNHANDLED_ERROR_PATTERN.test(fullOutput) },
        previousProcessClean && exit_code === 0 && process_exited === true && timed_out !== true
          && !UNHANDLED_ERROR_PATTERN.test(fullOutput)),
    ];
  }

  if (name === "host_shell") {
    const observed = { exit_code, process_exited, output: fullOutput.trim(), expectedVersion: "1.1.0" };
    return [assertion("native_shell_boundary", "The native host shell launches the locally pinned Pi CLI and returns exactly 1.1.0",
      observed, exit_code === 0 && process_exited === true && observed.output === observed.expectedVersion)];
  }

  throw new Error(`Unknown smoke case: ${name}`);
}
