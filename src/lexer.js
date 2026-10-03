// Turns Hokkien Script source code into a list of tokens.
//
// Every token looks like { type, value, line, column }, where line and column
// start at 1. The token types are:
//   keyword     value is the keyword spelled with single spaces, e.g. "na bo na si"
//   identifier  value is the name
//   number      value is a JavaScript number
//   string      value is the decoded string contents
//   operator    + - * / % = == != < > <= >= && || !
//   punctuation ( ) { } , ;
//   newline     a line break that ends a statement
//   eof         end of the source

import { KhaninaError } from "./errors.js";

export const KEYWORDS = [
  "u",
  "be pian",
  "na si",
  "na bo",
  "na bo na si",
  "koh",
  "cau",
  "tiau ke",
  "co",
  "tui",
  "kong",
  "si",
  "em si",
  "bo",
];

const KEYWORD_SET = new Set(KEYWORDS);

// Every word sequence that starts a multi-word keyword, e.g. "na" and "na bo na".
const KEYWORD_PREFIXES = new Set();
for (const keyword of KEYWORDS) {
  const words = keyword.split(" ");
  for (let i = 1; i < words.length; i++) {
    KEYWORD_PREFIXES.add(words.slice(0, i).join(" "));
  }
}

const OPERATORS = ["==", "!=", "<=", ">=", "&&", "||", "+", "-", "*", "/", "%", "=", "<", ">", "!"];
const PUNCTUATION = new Set(["(", ")", "{", "}", ",", ";"]);
const ESCAPES = { '"': '"', "\\": "\\", n: "\n", t: "\t" };

const isDigit = (ch) => ch >= "0" && ch <= "9";
const isWordStart = (ch) => (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
const isWordChar = (ch) => isWordStart(ch) || isDigit(ch);
const isBlank = (ch) => ch === " " || ch === "\t" || ch === "\r";

export function tokenize(source) {
  const src = source.startsWith("﻿") ? source.slice(1) : source;
  const tokens = [];
  let pos = 0;
  let line = 1;
  let column = 1;
  let parenDepth = 0;

  const peek = (offset = 0) => src[pos + offset];
  const advance = (count = 1) => {
    pos += count;
    column += count;
  };
  const push = (type, value, tokenLine, tokenColumn) => {
    tokens.push({ type, value, line: tokenLine, column: tokenColumn });
  };

  // Reads a word plus any following words that complete a multi-word keyword.
  // The longest keyword match wins; otherwise only the first word is used.
  const readWord = () => {
    const startColumn = column;
    let end = pos;
    while (end < src.length && isWordChar(src[end])) end++;

    const firstWord = src.slice(pos, end);
    let phrase = firstWord;
    let bestEnd = KEYWORD_SET.has(phrase) ? end : null;
    let bestPhrase = bestEnd === null ? null : phrase;

    let scan = end;
    while (KEYWORD_PREFIXES.has(phrase)) {
      let next = scan;
      while (src[next] === " " || src[next] === "\t") next++;
      if (next === scan || !isWordStart(src[next])) break;
      let nextEnd = next;
      while (nextEnd < src.length && isWordChar(src[nextEnd])) nextEnd++;
      phrase = `${phrase} ${src.slice(next, nextEnd)}`;
      scan = nextEnd;
      if (KEYWORD_SET.has(phrase)) {
        bestPhrase = phrase;
        bestEnd = nextEnd;
      }
    }

    if (bestPhrase !== null) {
      push("keyword", bestPhrase, line, startColumn);
      advance(bestEnd - pos);
    } else {
      push("identifier", firstWord, line, startColumn);
      advance(end - pos);
    }
  };

  const readNumber = () => {
    const startColumn = column;
    let end = pos;
    while (isDigit(src[end])) end++;
    if (src[end] === "." && isDigit(src[end + 1])) {
      end++;
      while (isDigit(src[end])) end++;
    }
    if (isWordChar(src[end] ?? "")) {
      throw new KhaninaError("nama tidak boleh diawali angka", line, startColumn);
    }
    push("number", Number(src.slice(pos, end)), line, startColumn);
    advance(end - pos);
  };

  const readString = () => {
    const startLine = line;
    const startColumn = column;
    advance(); // opening quote
    let value = "";
    for (;;) {
      const ch = peek();
      if (ch === undefined || ch === "\n" || (ch === "\r" && peek(1) === "\n")) {
        throw new KhaninaError("string belum ditutup", startLine, startColumn);
      }
      if (ch === '"') {
        advance();
        break;
      }
      if (ch === "\\") {
        const escaped = peek(1);
        if (escaped === undefined || escaped === "\n" || escaped === "\r") {
          throw new KhaninaError("string belum ditutup", startLine, startColumn);
        }
        if (!Object.hasOwn(ESCAPES, escaped)) {
          throw new KhaninaError(`escape "\\${escaped}" tidak dikenal`, line, column);
        }
        value += ESCAPES[escaped];
        advance(2);
        continue;
      }
      value += ch;
      advance();
    }
    push("string", value, startLine, startColumn);
  };

  while (pos < src.length) {
    const ch = peek();

    if (isBlank(ch)) {
      advance();
      continue;
    }

    if (ch === "\n") {
      const last = tokens[tokens.length - 1];
      if (parenDepth === 0 && last && last.type !== "newline") {
        push("newline", "\n", line, column);
      }
      pos++;
      line++;
      column = 1;
      continue;
    }

    if (ch === "/" && peek(1) === "/") {
      while (pos < src.length && peek() !== "\n") advance();
      continue;
    }

    if (isWordStart(ch)) {
      readWord();
      continue;
    }

    if (isDigit(ch)) {
      readNumber();
      continue;
    }

    if (ch === '"') {
      readString();
      continue;
    }

    if (PUNCTUATION.has(ch)) {
      if (ch === "(") parenDepth++;
      if (ch === ")" && parenDepth > 0) parenDepth--;
      push("punctuation", ch, line, column);
      advance();
      continue;
    }

    const operator = OPERATORS.find((op) => src.startsWith(op, pos));
    if (operator) {
      push("operator", operator, line, column);
      advance(operator.length);
      continue;
    }

    if (ch === "'") {
      throw new KhaninaError('string harus pakai kutip ganda "..."', line, column);
    }
    if (ch === "&" || ch === "|") {
      throw new KhaninaError(`karakter "${ch}" tidak dikenal, maksudnya "${ch}${ch}"?`, line, column);
    }
    const shown = String.fromCodePoint(src.codePointAt(pos));
    throw new KhaninaError(`karakter "${shown}" tidak dikenal`, line, column);
  }

  push("eof", null, line, column);
  return tokens;
}
