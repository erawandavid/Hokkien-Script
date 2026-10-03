// End-to-end tests: every program in examples/ is run with the khanina
// command, and its output must match the .expected.txt file next to it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const examples = join(root, "examples");
const cli = join(root, "bin", "khanina.js");

const programs = readdirSync(examples).filter((file) => file.endsWith(".khanina")).sort();

test("there are example programs", () => {
  assert.ok(programs.length > 0);
});

for (const program of programs) {
  test(`examples/${program}`, () => {
    const expectedFile = join(examples, program.replace(/\.khanina$/, ".expected.txt"));
    assert.ok(existsSync(expectedFile), `missing ${expectedFile}`);
    const result = spawnSync(process.execPath, [cli, join(examples, program)], { encoding: "utf8" });
    assert.equal(result.stderr, "");
    assert.equal(result.status, 0);
    assert.equal(result.stdout, readFileSync(expectedFile, "utf8"));
  });
}
