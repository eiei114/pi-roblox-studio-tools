import assert from "node:assert/strict";
import test from "node:test";
import { behaviorAssertions, parseJsonLines, SDK_VERSIONS, VERIFICATION_CONTRACT } from "../scripts/pi-sdk-smoke-contract.mjs";

const registration = { type: "response", command: "get_commands", success: true, data: { commands: [
  { name: "roblox-studio-mcp-status", source: "extension" },
] } };
const prompt = { type: "response", command: "prompt", success: true, data: { disposition: "handled" } };
const notification = { type: "extension_ui_request", method: "notify", notifyType: "info",
  message: "status\nplatform: win32\nsupported: true\nfound: true\ncallable: true\nreadiness: callable" };
const warning = { ...notification, notifyType: "warning",
  message: "status\nplatform: win32\nsupported: true\nfound: false\ncallable: false\nreadiness: not_found" };
const previousProcess = { exit_code: 0, process_exited: true, timed_out: false };
const observed = (responses = [registration, prompt, notification], fullOutput = "", exit_code = 0,
  process_exited = true, timed_out = false, previous_process = previousProcess) =>
  ({ responses, fullOutput, exit_code, process_exited, timed_out, previous_process });

test("frozen SDK contract and JSON-lines parsing", () => {
  assert.equal(VERIFICATION_CONTRACT, "pi-sdk-behavior-v2");
  assert.deepEqual(Object.values(SDK_VERSIONS), ["1.1.0", "1.1.0", "1.1.0", "1.1.0"]);
  assert.deepEqual(parseJsonLines(`not-json\r\n${JSON.stringify(prompt)}\n\n`), [prompt]);
});

test("extension registration requires the actual package command", () => {
  assert.equal(behaviorAssertions("extension_load", observed())[0].passed, true);
  for (const commands of [[], [{ name: "other", source: "extension" }],
    [{ name: "roblox-studio-mcp-status", source: "prompt" }]]) {
    assert.equal(behaviorAssertions("extension_load", observed([
      { ...registration, data: { commands } },
    ]))[0].passed, false);
  }
});

test("feature response requires the handled command and actual status fields", () => {
  assert.equal(behaviorAssertions("happy_path", observed())[0].passed, true);
  for (const responses of [[], [registration], [registration, { ...prompt, success: false }],
    [registration, prompt, { ...notification, message: "status" }]]) {
    assert.equal(behaviorAssertions("happy_path", observed(responses))[0].passed, false);
  }
});

test("handled missing-host error requires a warning and negative readiness", () => {
  assert.equal(behaviorAssertions("error_path", observed([registration, prompt, warning]))[0].passed, true);
  for (const responses of [[], [registration, prompt], [registration, prompt, notification],
    [registration, { ...prompt, data: { disposition: "started" } }, warning]]) {
    assert.equal(behaviorAssertions("error_path", observed(responses))[0].passed, false);
  }
});

test("reload evidence requires second-process registration, feature response and clean shutdown", () => {
  const good = behaviorAssertions("reload_cleanup", observed());
  assert.deepEqual(good.map((item) => item.id), [
    "reloaded_extension_registered", "reloaded_feature_response", "clean_shutdown",
  ]);
  assert.ok(good.every((item) => item.passed));
  for (const responses of [[], [prompt, notification], [registration], [registration, prompt],
    [registration, { ...prompt, success: false }, notification]]) {
    assert.ok(behaviorAssertions("reload_cleanup", observed(responses)).some((item) => !item.passed));
  }
  for (const [output, code, processExited, timedOut] of [
    ["shutdown error", 0, true, false], ["UnhandledPromiseRejection", 0, true, false], ["", 1, true, false], ["", 0, false, true],
  ]) {
    assert.equal(behaviorAssertions("reload_cleanup", observed(undefined, output, code, processExited, timedOut))[2].passed, false);
  }
  assert.equal(behaviorAssertions("reload_cleanup", observed(undefined, "", 0, true, false,
    { exit_code: 0, process_exited: false, timed_out: true }))[2].passed, false);
});

test("native shell assertion requires exact pinned Pi version and clean exit", () => {
  assert.equal(behaviorAssertions("host_shell", observed([], "1.1.0\r\n"))[0].passed, true);
  for (const [output, code, exited] of [["", 0, true], ["11.1.0", 0, true], ["1.1.0 but error", 0, true], ["1.1.0", 1, true], ["1.1.0", 0, false]]) {
    assert.equal(behaviorAssertions("host_shell", observed([], output, code, exited))[0].passed, false);
  }
});
