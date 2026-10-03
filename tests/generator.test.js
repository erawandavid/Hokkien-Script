import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { tokenize } from "../src/lexer.js";
import { parse } from "../src/parser.js";
import { generateWithSourceLines } from "../src/generator.js";
import { compile } from "../src/index.js";

// Compiles and returns the JavaScript without the "use strict" header and kong helper.
const body = (source) => {
  const code = compile(source);
  return code
    .replace('"use strict";\n\n', "")
    .replace(/^function \$kong[\s\S]*?\n}\n\n/, "");
};

const runJs = (code) => {
  const result = spawnSync(process.execPath, ["--input-type=module"], { input: code, encoding: "utf8" });
  return { stdout: result.stdout, stderr: result.stderr, status: result.status };
};

test("output starts with use strict", () => {
  assert.equal(compile(""), '"use strict";\n');
  assert.equal(compile("u x = 1"), '"use strict";\n\nlet x = 1;\n');
});

test("the kong helper is only added when kong is used", () => {
  assert.doesNotMatch(compile("u x = 1"), /\$kong/);
  assert.match(compile("kong(1)"), /^"use strict";\n\nfunction \$kong\(\.\.\.values\) \{\n/);
});

test("declarations, assignment, and kong", () => {
  assert.equal(
    body('u umur = 20\nu nama\nbe pian PAJAK = 0.11\numur = umur + 1\nkong("umur:", umur)'),
    'let umur = 20;\nlet nama = null;\nconst PAJAK = 0.11;\numur = umur + 1;\n$kong("umur:", umur);\n',
  );
});

test("literals", () => {
  assert.equal(
    body('u a = si\nu b = em si\nu c = bo\nu d = 3.14\nu e = "kata \\"kutip\\"\\n"'),
    'let a = true;\nlet b = false;\nlet c = null;\nlet d = 3.14;\nlet e = "kata \\"kutip\\"\\n";\n',
  );
});

test("== and != become === and !==", () => {
  assert.equal(body("u a = x == 1 && y != 2"), "let a = x === 1 && y !== 2;\n");
});

test("parentheses are kept only where needed", () => {
  assert.equal(body("u a = (1 + 2) * 3"), "let a = (1 + 2) * 3;\n");
  assert.equal(body("u a = 1 + (2 * 3)"), "let a = 1 + 2 * 3;\n");
  assert.equal(body("u a = 10 - (4 - 3)"), "let a = 10 - (4 - 3);\n");
  assert.equal(body("u a = (10 - 4) - 3"), "let a = 10 - 4 - 3;\n");
  assert.equal(body("u a = !(x > 1)"), "let a = !(x > 1);\n");
  assert.equal(body("u a = -(x + 1)"), "let a = -(x + 1);\n");
  assert.equal(body("u a = - -x"), "let a = -(-x);\n");
  assert.equal(body("u a = !!x"), "let a = !!x;\n");
  assert.equal(body("u a = x - -1"), "let a = x - -1;\n");
  assert.equal(body("u a = (x || y) && z"), "let a = (x || y) && z;\n");
});

test("na si / na bo na si / na bo", () => {
  const source = `
na si (n >= 90) {
  kong("A")
} na bo na si (n >= 70) {
  kong("B")
} na bo {
  kong("C")
}`;
  assert.equal(
    body(source),
    [
      "if (n >= 90) {",
      '  $kong("A");',
      "} else if (n >= 70) {",
      '  $kong("B");',
      "} else {",
      '  $kong("C");',
      "}",
      "",
    ].join("\n"),
  );
});

test("koh, cau, tiau ke", () => {
  assert.equal(
    body("koh (si) {\n  na si (a) {\n    cau\n  }\n  tiau ke\n}"),
    "while (true) {\n  if (a) {\n    break;\n  }\n  continue;\n}\n",
  );
});

test("co, tui, and calls, with blank lines around functions", () => {
  assert.equal(
    body("u a = 1\nco f(x, y) {\n  tui x + y\n}\nco g() {\n  tui\n}\ng()"),
    [
      "let a = 1;",
      "",
      "function f(x, y) {",
      "  return x + y;",
      "}",
      "",
      "function g() {",
      "  return;",
      "}",
      "",
      "g();",
      "",
    ].join("\n"),
  );
});

test("names that clash with JavaScript get a $ prefix", () => {
  assert.equal(
    body("u new = 1\nco class(this) {\n  tui this\n}\nnew = class(new)"),
    "let $new = 1;\n\nfunction $class($this) {\n  return $this;\n}\n\n$new = $class($new);\n",
  );
});

test("a variable named console does not break kong", () => {
  const { stdout } = runJs(compile("u console = 5\nkong(console)"));
  assert.equal(stdout, "5\n");
});

test("kong prints si, em si, and bo", () => {
  const { stdout } = runJs(compile('co diam() {\n}\nkong(si, em si, bo, diam(), 0, "")\nkong()\nkong("x: " + si)'));
  assert.equal(stdout, "si em si bo bo 0 \n\nx: true\n");
});

test("source lines are recorded for every generated statement", () => {
  const source = 'u a = 1\n\nna si (a == 1) {\n  kong("ya")\n} na bo {\n  kong("tidak")\n}';
  const { code, sourceLines } = generateWithSourceLines(parse(tokenize(source)));
  const lines = code.trimEnd().split("\n");
  assert.equal(lines.length, sourceLines.length);
  const lineOf = (text) => sourceLines[lines.findIndex((line) => line.includes(text))];
  assert.equal(lineOf("let a"), 1);
  assert.equal(lineOf("if (a === 1)"), 3);
  assert.equal(lineOf('$kong("ya")'), 4);
  assert.equal(lineOf("} else {"), 5);
  assert.equal(lineOf('$kong("tidak")'), 6);
  assert.equal(sourceLines[0], null);
});

test("every example runs with the expected output", async () => {
  const dir = new URL("../examples/", import.meta.url);
  const files = (await readdir(dir)).filter((file) => file.endsWith(".khanina"));
  assert.ok(files.length > 0);
  for (const file of files) {
    const source = await readFile(new URL(file, dir), "utf8");
    const expected = await readFile(new URL(file.replace(/\.khanina$/, ".expected.txt"), dir), "utf8");
    const { stdout, stderr, status } = runJs(compile(source));
    assert.equal(status, 0, `${file}: ${stderr}`);
    assert.equal(stdout, expected, file);
  }
});

test("kong prints % signs and functions as plain text", () => {
  const { stdout } = runJs(compile('co tambah(a, b) {\n  tui a + b\n}\nkong("%d persen", 5)\nkong(tambah)'));
  assert.equal(stdout, "%d persen 5\n[Function: tambah]\n");
});
