import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../bin/khanina.js", import.meta.url));

// Feeds lines to `khanina` without a file and returns what it printed,
// without the welcome text and the prompts.
const session = (...lines) => {
  const result = spawnSync(process.execPath, [cli], { input: `${lines.join("\n")}\n.exit\n`, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout
    .split("\n")
    .slice(2)
    .join("\n")
    .replace(/khanina> |\.\.\. /g, "")
    .trim()
    .split("\n");
};

test("shows a welcome message", () => {
  const result = spawnSync(process.execPath, [cli], { input: ".exit\n", encoding: "utf8" });
  assert.match(result.stdout, /^li ho! Hokkien Script \d+\.\d+\.\d+\nType \.help for help, \.exit to quit\.\n/);
});

test("names created in one input can be used in the next", () => {
  assert.deepEqual(session("u x = 20", 'kong("x:", x)', "x = x + 1", "kong(x)"), ["x: 20", "21"]);
});

test("a bare expression prints its value the Hokkien way", () => {
  assert.deepEqual(session("1 + 2", "3 > 4", "1 < 2", "bo", '"li ho"'), ["3", "em si", "si", "bo", '"li ho"']);
});

test("a call prints its result only when it returns something", () => {
  assert.deepEqual(
    session("co tambah(a, b) {", "  tui a + b", "}", "co sapa() {", '  kong("li ho")', "}", "tambah(2, 3)", "sapa()"),
    ["5", "li ho"],
  );
});

test("an unclosed block continues on the next line", () => {
  assert.deepEqual(
    session("u umur = 20", "na si (umur >= 17) {", '  kong("boleh")', "} na bo {", '  kong("belum")', "}"),
    ["boleh"],
  );
});

test("compile-time checks know about earlier inputs", () => {
  assert.deepEqual(session("u x = 1", "u x = 2", "be pian P = 1", "P = 2"), [
    'paiseh, baris 1 kolom 3: "x" sudah dibuat di blok ini',
    "  1 | u x = 2",
    "    |   ^",
    'paiseh, baris 1 kolom 1: "P" itu be pian, nilainya tidak bisa diubah',
    "  1 | P = 2",
    "    | ^",
  ]);
});

test("an unknown name in an initial value is caught before running", () => {
  assert.deepEqual(session("u y = belum_ada", "u y = 1", "kong(y)"), [
    'paiseh, baris 1 kolom 7: "belum_ada" belum dibuat',
    "  1 | u y = belum_ada",
    "    |       ^",
    "1",
  ]);
});

test("runtime and lexer errors are reported and the prompt keeps going", () => {
  assert.deepEqual(session("kong(z)", "kong(1 @ 2)", 'kong("masih jalan")'), [
    'paiseh, baris 1: "z" belum dibuat',
    "  1 | kong(z)",
    'paiseh, baris 1 kolom 8: karakter "@" tidak dikenal',
    "  1 | kong(1 @ 2)",
    "    |        ^",
    "masih jalan",
  ]);
});
