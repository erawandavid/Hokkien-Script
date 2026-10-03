import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenize } from "../src/lexer.js";

// Returns tokens as compact "type:value" strings, without the final eof.
const kinds = (source) =>
  tokenize(source)
    .filter((token) => token.type !== "eof")
    .map((token) => `${token.type}:${token.value === "\n" ? "\\n" : token.value}`);

test("hello world", () => {
  assert.deepEqual(kinds('kong("li ho, dunia!")'), [
    "keyword:kong",
    "punctuation:(",
    "string:li ho, dunia!",
    "punctuation:)",
  ]);
});

test("na si is one keyword, si alone is another", () => {
  assert.deepEqual(kinds("na si (si)"), [
    "keyword:na si",
    "punctuation:(",
    "keyword:si",
    "punctuation:)",
  ]);
});

test("na bo is one keyword, bo alone is another", () => {
  assert.deepEqual(kinds("} na bo {\nx = bo"), [
    "punctuation:}",
    "keyword:na bo",
    "punctuation:{",
    "newline:\\n",
    "identifier:x",
    "operator:=",
    "keyword:bo",
  ]);
});

test("na bo na si is read as a single keyword (longest match)", () => {
  assert.deepEqual(kinds("} na bo na si (x) {"), [
    "punctuation:}",
    "keyword:na bo na si",
    "punctuation:(",
    "identifier:x",
    "punctuation:)",
    "punctuation:{",
  ]);
});

test("na bo followed by something else falls back to na bo", () => {
  assert.deepEqual(kinds("na bo na x"), ["keyword:na bo", "identifier:na", "identifier:x"]);
  assert.deepEqual(kinds("na bo na"), ["keyword:na bo", "identifier:na"]);
});

test("em si, be pian, and tiau ke are two-word keywords", () => {
  assert.deepEqual(kinds("em si"), ["keyword:em si"]);
  assert.deepEqual(kinds("be pian X = 1"), ["keyword:be pian", "identifier:X", "operator:=", "number:1"]);
  assert.deepEqual(kinds("tiau ke"), ["keyword:tiau ke"]);
});

test("first words of two-word keywords are ordinary names on their own", () => {
  assert.deepEqual(kinds("u em = 5"), ["keyword:u", "identifier:em", "operator:=", "number:5"]);
  assert.deepEqual(kinds("kong(na, be, tiau)"), [
    "keyword:kong",
    "punctuation:(",
    "identifier:na",
    "punctuation:,",
    "identifier:be",
    "punctuation:,",
    "identifier:tiau",
    "punctuation:)",
  ]);
});

test("two-word keywords may be separated by several spaces or tabs", () => {
  assert.deepEqual(kinds("na   si"), ["keyword:na si"]);
  assert.deepEqual(kinds("be\tpian"), ["keyword:be pian"]);
  assert.deepEqual(kinds("na bo \t na  si"), ["keyword:na bo na si"]);
});

test("two-word keywords are not joined across a line break", () => {
  assert.deepEqual(kinds("na\nsi"), ["identifier:na", "newline:\\n", "keyword:si"]);
  assert.deepEqual(kinds("em\nsi"), ["identifier:em", "newline:\\n", "keyword:si"]);
  assert.deepEqual(kinds("na bo\nna si"), ["keyword:na bo", "newline:\\n", "keyword:na si"]);
});

test("names that start with a keyword are names", () => {
  assert.deepEqual(kinds("kongsi sinar umur bodoh coklat tuin koha cau2 u_"), [
    "identifier:kongsi",
    "identifier:sinar",
    "identifier:umur",
    "identifier:bodoh",
    "identifier:coklat",
    "identifier:tuin",
    "identifier:koha",
    "identifier:cau2",
    "identifier:u_",
  ]);
  assert.deepEqual(kinds("na sinar"), ["identifier:na", "identifier:sinar"]);
  assert.deepEqual(kinds("em sikat"), ["identifier:em", "identifier:sikat"]);
});

test("keywords are case-sensitive", () => {
  assert.deepEqual(kinds("Kong NA SI Bo"), [
    "identifier:Kong",
    "identifier:NA",
    "identifier:SI",
    "identifier:Bo",
  ]);
});

test("keywords inside strings and comments are not keywords", () => {
  assert.deepEqual(kinds('kong("na si kong bo em si") // na bo u co'), [
    "keyword:kong",
    "punctuation:(",
    "string:na si kong bo em si",
    "punctuation:)",
  ]);
});

test("every keyword is recognized", () => {
  const source = "u be pian na si na bo koh cau tiau ke co tui kong si em si bo";
  assert.deepEqual(kinds(source), [
    "keyword:u",
    "keyword:be pian",
    "keyword:na si",
    "keyword:na bo",
    "keyword:koh",
    "keyword:cau",
    "keyword:tiau ke",
    "keyword:co",
    "keyword:tui",
    "keyword:kong",
    "keyword:si",
    "keyword:em si",
    "keyword:bo",
  ]);
});

test("numbers", () => {
  assert.deepEqual(kinds("42 3.14 0"), ["number:42", "number:3.14", "number:0"]);
});

test("string escapes", () => {
  const [token] = tokenize('"a\\"b\\\\c\\nd\\te"');
  assert.equal(token.type, "string");
  assert.equal(token.value, 'a"b\\c\nd\te');
});

test("operators use the longest match", () => {
  assert.deepEqual(kinds("== != <= >= && || ! = < > + - * / %"), [
    "operator:==",
    "operator:!=",
    "operator:<=",
    "operator:>=",
    "operator:&&",
    "operator:||",
    "operator:!",
    "operator:=",
    "operator:<",
    "operator:>",
    "operator:+",
    "operator:-",
    "operator:*",
    "operator:/",
    "operator:%",
  ]);
  assert.deepEqual(kinds("a<=-b"), ["identifier:a", "operator:<=", "operator:-", "identifier:b"]);
});

test("blank lines and comment lines produce a single newline", () => {
  assert.deepEqual(kinds("\n\nkong(1)\n\n// komentar\n\nkong(2)\n"), [
    "keyword:kong",
    "punctuation:(",
    "number:1",
    "punctuation:)",
    "newline:\\n",
    "keyword:kong",
    "punctuation:(",
    "number:2",
    "punctuation:)",
    "newline:\\n",
  ]);
});

test("line breaks inside parentheses are ignored", () => {
  assert.deepEqual(kinds("kong(\n  1,\n  2\n)"), [
    "keyword:kong",
    "punctuation:(",
    "number:1",
    "punctuation:,",
    "number:2",
    "punctuation:)",
  ]);
});

test("Windows line endings and a byte order mark are accepted", () => {
  assert.deepEqual(kinds("﻿u x = 1\r\nkong(x)\r\n"), [
    "keyword:u",
    "identifier:x",
    "operator:=",
    "number:1",
    "newline:\\n",
    "keyword:kong",
    "punctuation:(",
    "identifier:x",
    "punctuation:)",
    "newline:\\n",
  ]);
});

test("tokens record their line and column", () => {
  const tokens = tokenize('u umur = 20\n\nna si (umur >= 17) {\n  kong("ok")\n}');
  const at = (value) => {
    const token = tokens.find((t) => t.value === value);
    return [token.line, token.column];
  };
  assert.deepEqual(at("u"), [1, 1]);
  assert.deepEqual(at(20), [1, 10]);
  assert.deepEqual(at("na si"), [3, 1]);
  assert.deepEqual(at(">="), [3, 13]);
  assert.deepEqual(at(17), [3, 16]);
  assert.deepEqual(at("kong"), [4, 3]);
  assert.deepEqual(at("ok"), [4, 8]);
  assert.deepEqual(at("}"), [5, 1]);
  assert.deepEqual(tokens.at(-1), { type: "eof", value: null, line: 5, column: 2 });
});

test("the token after a two-word keyword has the right column", () => {
  const tokens = tokenize("na  bo   na si (x)");
  assert.deepEqual(
    tokens.slice(0, 2).map((t) => [t.value, t.column]),
    [
      ["na bo na si", 1],
      ["(", 16],
    ],
  );
});

const throwsAt = (source, message, line, column) => {
  assert.throws(() => tokenize(source), (error) => {
    assert.equal(error.name, "KhaninaError");
    assert.equal(error.message, `paiseh, baris ${line} kolom ${column}: ${message}`);
    return true;
  });
};

test("error: unknown character", () => {
  throwsAt("u x = 1\nu y = x @ 2", 'karakter "@" tidak dikenal', 2, 9);
  throwsAt("u harga$ = 1", 'karakter "$" tidak dikenal', 1, 8);
});

test("error: unclosed string", () => {
  throwsAt('kong("li ho)', "string belum ditutup", 1, 6);
  throwsAt('kong("li ho\n")', "string belum ditutup", 1, 6);
  throwsAt('kong("li ho\\', "string belum ditutup", 1, 6);
});

test("error: unknown escape", () => {
  throwsAt('kong("a\\qb")', 'escape "\\q" tidak dikenal', 1, 8);
});

test("error: single quotes", () => {
  throwsAt("kong('li ho')", 'string harus pakai kutip ganda "..."', 1, 6);
});

test("error: name starting with a digit", () => {
  throwsAt("u 2x = 1", "nama tidak boleh diawali angka", 1, 3);
});

test("error: single & or |", () => {
  throwsAt("na si (a & b) {}", 'karakter "&" tidak dikenal, maksudnya "&&"?', 1, 10);
  throwsAt("na si (a | b) {}", 'karakter "|" tidak dikenal, maksudnya "||"?', 1, 10);
});
