// Errors raised while compiling or running a .khanina program.
// Messages follow the format in SPEC.md section 6:
//   paiseh, baris 3 kolom 5: kurung kurawal belum ditutup

export function formatMessage(message, line = null, column = null) {
  if (line == null) {
    return `paiseh, ${message}`;
  }
  if (column == null) {
    return `paiseh, baris ${line}: ${message}`;
  }
  return `paiseh, baris ${line} kolom ${column}: ${message}`;
}

export class KhaninaError extends Error {
  constructor(message, line = null, column = null) {
    super(formatMessage(message, line, column));
    this.name = "KhaninaError";
    this.detail = message;
    this.line = line;
    this.column = column;
  }
}

// Shows the source line an error points at, with a ^ under the column:
//
//     2 | na si (si) {
//       |            ^
//
// Tabs are widened to two spaces so the ^ lines up in every terminal.
export function codeFrame(source, line, column = null) {
  const lines = source.replace(/^﻿/, "").split(/\r?\n/);
  const text = lines[line - 1];
  if (text === undefined) return "";
  const gutter = String(line);
  const widen = (part) => part.replace(/\t/g, "  ");
  const frame = [`  ${gutter} | ${widen(text)}`];
  if (column != null) {
    const before = widen(text.slice(0, column - 1));
    frame.push(`  ${" ".repeat(gutter.length)} | ${" ".repeat(before.length)}^`);
  }
  return frame.join("\n");
}

// Names that clash with JavaScript get a $ prefix in the output (see the
// generator); error messages show them as the user wrote them.
const userName = (name) => name.replace(/^\$/, "");

// Node.js and Chrome messages come first, followed by Firefox and Safari ones
// (used by the web playground).
const notCreated = (name) => `"${userName(name)}" belum dibuat`;
const usedTooEarly = (name) => (name ? `"${userName(name)}" dipakai sebelum dibuat` : "nama dipakai sebelum dibuat");
const createdTwice = (name) => `"${userName(name)}" sudah dibuat`;
const constant = () => "nilai be pian tidak bisa diubah";
const tooDeep = () => "fungsi memanggil dirinya sendiri terlalu dalam, mungkin rekursinya tidak pernah berhenti";

const RUNTIME_MESSAGES = [
  [/^(\S+) is not defined$/, notCreated],
  [/^Can't find variable: (\S+)$/, notCreated],
  [/^Cannot access '(.+)' before initialization$/, usedTooEarly],
  [/^can't access lexical declaration '(.+)' before initialization$/, usedTooEarly],
  [/^Cannot access uninitialized variable\.$/, () => usedTooEarly(null)],
  [/^Identifier '(.+)' has already been declared$/, createdTwice],
  [/^redeclaration of (?:let|const) (\S+)$/, createdTwice],
  [/^Assignment to constant variable\.$/, constant],
  [/^invalid assignment to const '(.+)'$/, constant],
  [/^Attempted to assign to readonly property\.$/, constant],
  [/^(.+?) is not a function/, (callee) => `"${userName(callee)}" bukan fungsi, jadi tidak bisa dipanggil`],
  [/^Maximum call stack size exceeded\.?$/, tooDeep],
  [/^too much recursion$/, tooDeep],
];

// Turns an error thrown by the generated JavaScript into a Hokkien Script message.
export function runtimeMessage(error) {
  const message = String(error?.message ?? error);
  for (const [pattern, translate] of RUNTIME_MESSAGES) {
    const match = message.match(pattern);
    if (match) return translate(...match.slice(1));
  }
  return message;
}

// Finds the .khanina line where a runtime error happened, using the stack
// trace of the generated code (run under `filename`) and the source line map
// from the generator. Returns null if it cannot tell.
export function runtimeLine(error, filename, sourceLines) {
  const stack = String(error?.stack ?? "");
  const escaped = filename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const frame = new RegExp(`${escaped}:(\\d+):\\d+`, "g");
  for (const match of stack.matchAll(frame)) {
    const line = sourceLines[Number(match[1]) - 1];
    if (line != null) return line;
  }
  return null;
}
