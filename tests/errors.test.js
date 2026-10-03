import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { KhaninaError, formatMessage, codeFrame, runtimeMessage, runtimeLine } from "../src/errors.js";
import { compileWithSourceLines } from "../src/index.js";

test("error message shows line and column", () => {
  const error = new KhaninaError("kurung kurawal belum ditutup", 3, 5);
  assert.equal(error.message, "paiseh, baris 3 kolom 5: kurung kurawal belum ditutup");
  assert.equal(error.detail, "kurung kurawal belum ditutup");
  assert.equal(error.line, 3);
  assert.equal(error.column, 5);
});

test("error message without a column shows only the line", () => {
  assert.equal(formatMessage('"x" belum dibuat', 4), 'paiseh, baris 4: "x" belum dibuat');
});

test("error message without a position only has the paiseh prefix", () => {
  assert.equal(formatMessage("file tidak ditemukan"), "paiseh, file tidak ditemukan");
});

test("code frame points at the column", () => {
  const source = 'u a = 1\nna si (a) {\n  kong("x")\n';
  assert.equal(codeFrame(source, 2, 11), "  2 | na si (a) {\n    |           ^");
  assert.equal(codeFrame(source, 3), '  3 |   kong("x")');
});

test("code frame lines up the ^ when the line has tabs", () => {
  assert.equal(codeFrame('\tkong("x" @)', 1, 11), '  1 |   kong("x" @)\n    |            ^');
});

test("code frame widens the gutter for long files and handles CRLF", () => {
  const source = `${"kong(1)\r\n".repeat(11)}kong(1 2)\r\n`;
  assert.equal(codeFrame(source, 12, 8), "  12 | kong(1 2)\n     |        ^");
  assert.equal(codeFrame(source, 99), "");
});

// Compiles and runs a program the way the CLI does, and returns the error message and line.
const runtimeError = (source) => {
  const { code, sourceLines } = compileWithSourceLines(source);
  try {
    vm.runInNewContext(code, { console: { log() {} } }, { filename: "test.khanina" });
  } catch (error) {
    return [runtimeMessage(error), runtimeLine(error, "test.khanina", sourceLines)];
  }
  throw new Error("expected the program to fail");
};

test("runtime: using a name that was never created", () => {
  assert.deepEqual(runtimeError("u a = 1\n\nkong(a + b)"), ['"b" belum dibuat', 3]);
  assert.deepEqual(runtimeError("belum = 3"), ['"belum" belum dibuat', 1]);
});

test("runtime: names with a $ prefix are shown as written", () => {
  assert.deepEqual(runtimeError("kong(new)"), ['"new" belum dibuat', 1]);
});

test("runtime: using a name before it is created", () => {
  assert.deepEqual(runtimeError("co f() {\n  tui y\n}\nkong(f())\nu y = 1"), ['"y" dipakai sebelum dibuat', 2]);
});

test("runtime: calling something that is not a function", () => {
  assert.deepEqual(runtimeError("u x = 5\nkong(x(1))"), ['"x" bukan fungsi, jadi tidak bisa dipanggil', 2]);
});

test("runtime: recursion that never stops", () => {
  assert.deepEqual(runtimeError("co f(n) {\n  tui f(n + 1)\n}\nf(1)"), [
    "fungsi memanggil dirinya sendiri terlalu dalam, mungkin rekursinya tidak pernah berhenti",
    2,
  ]);
});

test("runtime: other messages are kept as they are", () => {
  assert.equal(runtimeMessage(new Error("something else")), "something else");
  assert.equal(runtimeMessage("plain"), "plain");
});

test("runtime line is null when the stack does not mention the program", () => {
  assert.equal(runtimeLine(new Error("x"), "test.khanina", [1]), null);
  assert.equal(runtimeLine({}, "test.khanina", [1]), null);
});

test("runtime: a name declared twice across separate scripts", () => {
  const context = vm.createContext({});
  vm.runInContext("let x = 1;", context);
  try {
    vm.runInContext("let x = 2;", context);
    assert.fail("expected an error");
  } catch (error) {
    assert.equal(runtimeMessage(error), '"x" sudah dibuat');
  }
});
