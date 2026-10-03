import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const cli = join(root, "bin", "khanina.js");
const example = (name) => join(root, "examples", name);

const khanina = (...args) => {
  const result = spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
  return { stdout: result.stdout, stderr: result.stderr, status: result.status };
};

const withTempDir = (callback) => {
  const dir = mkdtempSync(join(tmpdir(), "khanina-"));
  try {
    return callback(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

test("runs a program", () => {
  assert.deepEqual(khanina(example("halo.khanina")), { stdout: "li ho, dunia!\n", stderr: "", status: 0 });
});

test("--out saves the JavaScript without running it", () => {
  withTempDir((dir) => {
    const out = join(dir, "hasil.js");
    const { stdout, status } = khanina(example("hitung.khanina"), "--out", out);
    assert.equal(status, 0);
    assert.equal(stdout, `Saved the translated JavaScript to ${out}\n`);
    assert.match(readFileSync(out, "utf8"), /^"use strict";/);
    const run = spawnSync(process.execPath, [out], { encoding: "utf8" });
    assert.equal(run.stdout, "11\n12\n13\n");
  });
});

test("--out refuses to overwrite the source file", () => {
  const { stderr, status } = khanina(example("halo.khanina"), "--out", example("halo.khanina"));
  assert.equal(status, 1);
  assert.equal(stderr, "paiseh, --out tidak boleh menimpa file .khanina itu sendiri\n");
});

test("--tokens shows tokens without running", () => {
  const { stdout, status } = khanina(example("halo.khanina"), "--tokens");
  assert.equal(status, 0);
  assert.match(stdout, /^1:1 +keyword +"kong"$/m);
  assert.match(stdout, /^1:6 +string +"li ho, dunia!"$/m);
  assert.doesNotMatch(stdout, /^li ho, dunia!$/m);
});

test("--ast shows the syntax tree as JSON without running", () => {
  const { stdout, status } = khanina(example("halo.khanina"), "--ast");
  assert.equal(status, 0);
  const ast = JSON.parse(stdout);
  assert.equal(ast.type, "Program");
  assert.equal(ast.body[0].type, "Print");
});

test("--help and --version", () => {
  assert.match(khanina("--help").stdout, /^Usage: khanina <file\.khanina>/);
  const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.equal(khanina("--version").stdout, `${version}\n`);
});

test("debug options without a file fail", () => {
  const { stderr, status } = khanina("--tokens");
  assert.equal(status, 1);
  assert.equal(stderr, "paiseh, opsi ini butuh file .khanina, contoh: khanina halo.khanina --tokens\n");
});

test("error: file without the .khanina extension", () => {
  const { stderr, status } = khanina(join(root, "README.md"));
  assert.equal(status, 1);
  assert.match(stderr, /^paiseh, file harus berekstensi \.khanina, bukan ".*README\.md"\n$/);
});

test("error: file not found", () => {
  assert.deepEqual(khanina("tidak-ada.khanina"), {
    stdout: "",
    stderr: 'paiseh, file "tidak-ada.khanina" tidak ditemukan\n',
    status: 1,
  });
});

test("error: unknown option and missing --out value", () => {
  assert.equal(khanina(example("halo.khanina"), "--foo").stderr, 'paiseh, opsi "--foo" tidak dikenal, lihat khanina --help\n');
  assert.equal(khanina(example("halo.khanina"), "--out").stderr, "paiseh, opsi --out butuh nama file, contoh: --out hasil.js\n");
});

test("error: more than one file", () => {
  const { stderr, status } = khanina("a.khanina", "b.khanina");
  assert.equal(status, 1);
  assert.equal(stderr, "paiseh, khanina hanya bisa membaca satu file sekaligus\n");
});

const runFile = (source) =>
  withTempDir((dir) => {
    const file = join(dir, "program.khanina");
    writeFileSync(file, source);
    return khanina(file);
  });

test("a lexer error stops the program before it runs and shows the line", () => {
  assert.deepEqual(runFile('kong("sebelum")\nu x = 1 @ 2\n'), {
    stdout: "",
    stderr: 'paiseh, baris 2 kolom 9: karakter "@" tidak dikenal\n  2 | u x = 1 @ 2\n    |         ^\n',
    status: 1,
  });
});

test("a parser error stops the program before it runs and shows the line", () => {
  assert.deepEqual(runFile('kong("sebelum")\nna si (si) {\n  kong("x")\n'), {
    stdout: "",
    stderr: "paiseh, baris 2 kolom 12: kurung kurawal belum ditutup\n  2 | na si (si) {\n    |            ^\n",
    status: 1,
  });
});

test("a runtime error shows the paiseh message and the .khanina line", () => {
  assert.deepEqual(runFile('kong("sebelum")\n\nkong(belum_ada)\nkong("sesudah")\n'), {
    stdout: "sebelum\n",
    stderr: 'paiseh, baris 3: "belum_ada" belum dibuat\n  3 | kong(belum_ada)\n',
    status: 1,
  });
});

test("a runtime error inside a function points at the line in the function", () => {
  const { stderr, status } = runFile("co bagi(a, b) {\n  tui a / b + c\n}\nkong(bagi(1, 2))\n");
  assert.equal(status, 1);
  assert.equal(stderr, 'paiseh, baris 2: "c" belum dibuat\n  2 |   tui a / b + c\n');
});
