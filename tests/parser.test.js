import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenize } from "../src/lexer.js";
import { parse } from "../src/parser.js";

const parseSource = (source) => parse(tokenize(source));

// Writes an expression as a compact prefix string, e.g. (+ 1 (* 2 3)).
const show = (expr) => {
  switch (expr.type) {
    case "Literal":
      return JSON.stringify(expr.value);
    case "Identifier":
      return expr.name;
    case "Unary":
      return `(${expr.operator} ${show(expr.argument)})`;
    case "Binary":
      return `(${expr.operator} ${show(expr.left)} ${show(expr.right)})`;
    case "Call":
      return `(call ${[expr.callee, ...expr.args].map(show).join(" ")})`;
  }
  throw new Error(`not an expression: ${expr.type}`);
};

const expr = (source) => show(parseSource(`u x = ${source}`).body[0].init);

// Removes line and column so trees can be compared by shape.
const strip = (value) => {
  if (Array.isArray(value)) return value.map(strip);
  if (value && typeof value === "object") {
    const { line, column, ...rest } = value;
    return Object.fromEntries(Object.entries(rest).map(([key, inner]) => [key, strip(inner)]));
  }
  return value;
};

test("literals", () => {
  assert.equal(expr("42"), "42");
  assert.equal(expr('"li ho"'), '"li ho"');
  assert.equal(expr("si"), "true");
  assert.equal(expr("em si"), "false");
  assert.equal(expr("bo"), "null");
});

test("arithmetic precedence and left associativity", () => {
  assert.equal(expr("1 + 2 * 3"), "(+ 1 (* 2 3))");
  assert.equal(expr("(1 + 2) * 3"), "(* (+ 1 2) 3)");
  assert.equal(expr("10 - 4 - 3"), "(- (- 10 4) 3)");
  assert.equal(expr("8 / 4 % 3"), "(% (/ 8 4) 3)");
});

test("comparison and logic precedence", () => {
  assert.equal(expr("a + 1 >= b * 2"), "(>= (+ a 1) (* b 2))");
  assert.equal(expr("a < b == c > d"), "(== (< a b) (> c d))");
  assert.equal(expr("a || b && c"), "(|| a (&& b c))");
  assert.equal(expr("a == 1 && b != 2 || c"), "(|| (&& (== a 1) (!= b 2)) c)");
});

test("unary operators", () => {
  assert.equal(expr("-a * b"), "(* (- a) b)");
  assert.equal(expr("!a && b"), "(&& (! a) b)");
  assert.equal(expr("!!a"), "(! (! a))");
  assert.equal(expr("- -1"), "(- (- 1))");
  assert.equal(expr("!(a > 1)"), "(! (> a 1))");
});

test("function calls", () => {
  assert.equal(expr("f()"), "(call f)");
  assert.equal(expr("tambah(i, 10) + 1"), "(+ (call tambah i 10) 1)");
  assert.equal(expr("f(g(1), 2 * 3)"), "(call f (call g 1) (* 2 3))");
  assert.equal(expr("f(1)(2)"), "(call (call f 1) 2)");
});

test("call arguments may span several lines", () => {
  assert.equal(expr("f(\n  1,\n  2\n)"), "(call f 1 2)");
});

test("declarations and assignment", () => {
  const { body } = parseSource("u umur = 20\nu nama\nbe pian PAJAK = 0.11\numur = umur + 1");
  assert.deepEqual(
    body.map((s) => [s.type, s.kind ?? null, s.name, s.init === undefined ? undefined : s.init && show(s.init)]),
    [
      ["VariableDeclaration", "u", "umur", "20"],
      ["VariableDeclaration", "u", "nama", null],
      ["VariableDeclaration", "be pian", "PAJAK", "0.11"],
      ["Assignment", null, "umur", undefined],
    ],
  );
  assert.equal(show(body[3].value), "(+ umur 1)");
});

test("kong takes any number of arguments", () => {
  const { body } = parseSource('kong()\nkong("a")\nkong("umur:", umur + 1)');
  assert.deepEqual(
    body.map((s) => [s.type, s.args.map(show)]),
    [
      ["Print", []],
      ["Print", ['"a"']],
      ["Print", ['"umur:"', "(+ umur 1)"]],
    ],
  );
});

test("semicolons separate statements on one line", () => {
  const { body } = parseSource("u a = 1; u b = 2;\nkong(a); kong(b)");
  assert.deepEqual(
    body.map((s) => s.type),
    ["VariableDeclaration", "VariableDeclaration", "Print", "Print"],
  );
});

test("na si / na bo na si / na bo chain", () => {
  const { body } = parseSource(`
na si (n >= 90) {
  kong("A")
} na bo na si (n >= 70) {
  kong("B")
} na bo {
  kong("C")
}`);
  assert.equal(body.length, 1);
  const [first] = body;
  assert.equal(first.type, "If");
  assert.equal(show(first.test), "(>= n 90)");
  assert.equal(first.alternate.type, "If");
  assert.equal(show(first.alternate.test), "(>= n 70)");
  assert.equal(first.alternate.alternate.type, "Block");
  assert.equal(first.alternate.alternate.body[0].type, "Print");
});

test("na bo may be on the line after the closing brace", () => {
  const sameLine = parseSource("na si (a) {\n  kong(1)\n} na bo {\n  kong(2)\n}");
  const nextLine = parseSource("na si (a) {\n  kong(1)\n}\nna bo {\n  kong(2)\n}");
  assert.deepEqual(strip(nextLine), strip(sameLine));
});

test("na si without na bo leaves the next statement alone", () => {
  const { body } = parseSource("na si (a) {\n  kong(1)\n}\n\nkong(2)");
  assert.deepEqual(
    body.map((s) => s.type),
    ["If", "Print"],
  );
  assert.equal(body[0].alternate, null);
});

test("one-line blocks", () => {
  const { body } = parseSource("na si (a) { kong(1) } na bo { kong(2) }");
  assert.equal(body[0].consequent.body.length, 1);
  assert.equal(body[0].alternate.body.length, 1);
});

test("koh with cau and tiau ke", () => {
  const { body } = parseSource(`
koh (si) {
  na si (i > 7) { cau }
  tiau ke
}`);
  const loop = body[0];
  assert.equal(loop.type, "While");
  assert.equal(show(loop.test), "true");
  assert.equal(loop.body.body[0].consequent.body[0].type, "Break");
  assert.equal(loop.body.body[1].type, "Continue");
});

test("co, tui, and calls as statements", () => {
  const { body } = parseSource(`
co tambah(a, b) {
  tui a + b
}
co diam() {
  tui
}
diam()`);
  const [tambah, diam, call] = body;
  assert.equal(tambah.type, "FunctionDeclaration");
  assert.deepEqual(tambah.params, ["a", "b"]);
  assert.equal(show(tambah.body.body[0].argument), "(+ a b)");
  assert.deepEqual(diam.params, []);
  assert.equal(diam.body.body[0].argument, null);
  assert.equal(call.type, "ExpressionStatement");
  assert.equal(show(call.expression), "(call diam)");
});

test("tui without a value before a closing brace", () => {
  const { body } = parseSource("co f() { tui }");
  assert.equal(body[0].body.body[0].argument, null);
});

test("recursion and nested functions", () => {
  const { body } = parseSource(`
co fakt(n) {
  na si (n <= 1) { tui 1 }
  co kali(a, b) { tui a * b }
  tui kali(n, fakt(n - 1))
}`);
  assert.equal(body[0].body.body[1].type, "FunctionDeclaration");
});

test("nodes record line and column", () => {
  const { body } = parseSource("u a = 1\n\n  na si (a == 1) {\n    kong(a)\n  }");
  assert.deepEqual([body[0].line, body[0].column], [1, 1]);
  assert.deepEqual([body[1].line, body[1].column], [3, 3]);
  assert.deepEqual([body[1].test.line, body[1].test.column], [3, 10]);
  assert.deepEqual([body[1].consequent.body[0].line, body[1].consequent.body[0].column], [4, 5]);
});

test("a name may be reused in an inner block or after its block ends", () => {
  parseSource(`
u x = 1
na si (x > 0) {
  u x = 2
}
na si (x > 0) {
  u y = 1
}
na si (x > 0) {
  u y = 2
}
co f(x) {
  tui x
}`);
});

test("every example parses", async () => {
  const { readdir, readFile } = await import("node:fs/promises");
  const dir = new URL("../examples/", import.meta.url);
  const files = (await readdir(dir)).filter((file) => file.endsWith(".khanina"));
  assert.ok(files.length > 0);
  for (const file of files) {
    const source = await readFile(new URL(file, dir), "utf8");
    assert.equal(parseSource(source).type, "Program", file);
  }
});

const throwsAt = (source, message, line, column) => {
  assert.throws(() => parseSource(source), (error) => {
    assert.equal(error.name, "KhaninaError");
    assert.equal(error.message, `paiseh, baris ${line} kolom ${column}: ${message}`);
    return true;
  });
};

test("error: unclosed curly brace points at the opening brace", () => {
  throwsAt('na si (a) {\n  kong("x")\n', "kurung kurawal belum ditutup", 1, 11);
  throwsAt("co f() {\n  koh (si) {\n    cau\n  }\n", "kurung kurawal belum ditutup", 1, 8);
});

test("error: unclosed parenthesis points at the opening parenthesis", () => {
  throwsAt("kong(1, 2", "kurung belum ditutup", 1, 5);
  throwsAt("u x = (1 + 2", "kurung belum ditutup", 1, 7);
  throwsAt("na si (a > 1", "kurung belum ditutup", 1, 7);
});

test("error: closing brace without an opening brace", () => {
  throwsAt("kong(1)\n}", 'kurung kurawal "}" tidak punya pasangan', 2, 1);
});

test("error: missing pieces", () => {
  throwsAt("na si (a > 1 {", 'seharusnya ")" di sini, bukan "{"', 1, 14);
  throwsAt("na si a > 1 {}", 'seharusnya "(" di sini, bukan nama "a"', 1, 7);
  throwsAt("na si (a)\n{\n}", 'seharusnya "{" di sini, bukan baris baru', 1, 10);
  throwsAt("kong(1 2)", 'seharusnya "," atau ")" di sini, bukan angka 2', 1, 8);
  throwsAt('kong "hai"', 'seharusnya "(" setelah kong, bukan string "hai"', 1, 6);
  throwsAt("u x = ", "seharusnya ada nilai di sini, bukan akhir file", 1, 7);
  throwsAt("u x = 1 +\n2", "seharusnya ada nilai di sini, bukan baris baru", 1, 10);
});

test("error: keyword or number where a name is needed", () => {
  throwsAt("u si = 1", 'seharusnya nama variabel di sini, bukan keyword "si"', 1, 3);
  throwsAt("co 5() {}", "seharusnya nama fungsi di sini, bukan angka 5", 1, 4);
  throwsAt("co f(a, 1) {}", "seharusnya nama parameter di sini, bukan angka 1", 1, 9);
});

test("error: two statements on one line", () => {
  throwsAt("kong(1) kong(2)", 'seharusnya ganti baris sebelum keyword "kong"', 1, 9);
  throwsAt("u x = 1 2", "seharusnya ganti baris sebelum angka 2", 1, 9);
});

test("error: na bo without na si", () => {
  throwsAt("na bo {\n}", "na bo harus ditulis setelah blok na si", 1, 1);
  throwsAt("kong(1)\nna bo na si (a) {}", "na bo na si harus ditulis setelah blok na si", 2, 1);
});

test("error: tui outside co", () => {
  throwsAt("tui 1", "tui hanya boleh dipakai di dalam co", 1, 1);
  throwsAt("koh (si) {\n  tui\n}", "tui hanya boleh dipakai di dalam co", 2, 3);
});

test("error: cau and tiau ke outside koh", () => {
  throwsAt("cau", "cau hanya boleh dipakai di dalam koh", 1, 1);
  throwsAt("na si (a) {\n  tiau ke\n}", "tiau ke hanya boleh dipakai di dalam koh", 2, 3);
  throwsAt("koh (si) {\n  co f() {\n    cau\n  }\n}", "cau hanya boleh dipakai di dalam koh", 3, 5);
});

test("error: be pian without a value", () => {
  throwsAt("be pian PAJAK", 'be pian "PAJAK" harus punya nilai awal', 1, 9);
});

test("error: assigning to be pian", () => {
  throwsAt("be pian PAJAK = 0.11\nPAJAK = 0.2", '"PAJAK" itu be pian, nilainya tidak bisa diubah', 2, 1);
  throwsAt(
    "be pian PAJAK = 0.11\nco ubah() {\n  PAJAK = 1\n}",
    '"PAJAK" itu be pian, nilainya tidak bisa diubah',
    3,
    3,
  );
});

test("an inner variable may shadow a be pian and then be changed", () => {
  parseSource("be pian X = 1\nna si (si) {\n  u X = 2\n  X = 3\n}");
});

test("error: name created twice in the same block", () => {
  throwsAt("u x = 1\nu x = 2", '"x" sudah dibuat di blok ini', 2, 3);
  throwsAt("co f() {}\nu f = 1", '"f" sudah dibuat di blok ini', 2, 3);
  throwsAt("co f(a) {\n  u a = 1\n}", '"a" sudah dibuat di blok ini', 2, 5);
  throwsAt("co f(a, a) {}", 'parameter "a" ditulis dua kali', 1, 9);
});

test("error: expression whose result is not used", () => {
  throwsAt("1 + 2", "hasil ekspresi ini tidak dipakai", 1, 1);
  throwsAt("umur == 5", 'hasil perbandingan ini tidak dipakai, maksudnya "=" untuk mengubah nilai?', 1, 1);
  throwsAt("1 = x", "yang bisa diberi nilai hanya nama variabel", 1, 1);
});

test("error: assignment is not an expression", () => {
  throwsAt("na si (x = 1) {}", 'seharusnya ")" di sini, bukan "="', 1, 10);
});

test("error: kong inside an expression", () => {
  throwsAt("u x = kong(1)", "kong tidak menghasilkan nilai, pakai sebagai statement saja", 1, 7);
});

test("error: unexpected token at the start of a statement", () => {
  throwsAt(")", 'seharusnya ada nilai di sini, bukan ")"', 1, 1);
});
