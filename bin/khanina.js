#!/usr/bin/env node
// The khanina command: runs .khanina files, or shows their translation.

import { readFileSync, writeFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { parseArgs } from "node:util";
import vm from "node:vm";
import { compileWithSourceLines, tokenize, parse, KhaninaError } from "../src/index.js";
import { formatMessage } from "../src/errors.js";

const USAGE = `Usage: khanina <file.khanina> [options]

Runs a Hokkien Script program.

Options:
  --out <file.js>  save the translated JavaScript instead of running it
  --tokens         show the tokens from the lexer instead of running
  --ast            show the syntax tree from the parser instead of running
  -h, --help       show this help
  -v, --version    show the version`;

function readVersion() {
  const packageJson = new URL("../package.json", import.meta.url);
  return JSON.parse(readFileSync(packageJson, "utf8")).version;
}

function fail(message) {
  console.error(formatMessage(message));
  process.exit(1);
}

function parseCommandLine(argv) {
  try {
    return parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        out: { type: "string", short: "o" },
        tokens: { type: "boolean" },
        ast: { type: "boolean" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
    });
  } catch (error) {
    if (error.code === "ERR_PARSE_ARGS_UNKNOWN_OPTION") {
      const option = error.message.match(/'([^']+)'/)?.[1] ?? "";
      return fail(`opsi "${option}" tidak dikenal, lihat khanina --help`);
    }
    if (error.code === "ERR_PARSE_ARGS_INVALID_OPTION_VALUE") {
      return fail("opsi --out butuh nama file, contoh: --out hasil.js");
    }
    return fail(error.message);
  }
}

function readSource(file) {
  if (extname(file) !== ".khanina") {
    fail(`file harus berekstensi .khanina, bukan "${file}"`);
  }
  try {
    return readFileSync(file, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") fail(`file "${file}" tidak ditemukan`);
    if (error.code === "EISDIR") fail(`"${file}" adalah folder, bukan file`);
    return fail(`file "${file}" tidak bisa dibaca (${error.code ?? error.message})`);
  }
}

function showTokens(source) {
  for (const token of tokenize(source)) {
    const position = `${token.line}:${token.column}`.padEnd(8);
    const value = token.type === "newline" ? "" : JSON.stringify(token.value);
    console.log(`${position}${token.type.padEnd(12)}${value}`);
  }
}

// Runs the program in its own context, so names it creates cannot clash
// with the globals this command relies on.
function runProgram(code, file) {
  try {
    vm.runInNewContext(code, { console }, { filename: file });
  } catch (error) {
    console.error(formatMessage(error?.message ?? String(error)));
    process.exitCode = 1;
  }
}

function main() {
  const { values, positionals } = parseCommandLine(process.argv.slice(2));

  if (values.help) {
    console.log(USAGE);
    return;
  }
  if (values.version) {
    console.log(readVersion());
    return;
  }
  if (positionals.length === 0) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }
  if (positionals.length > 1) {
    fail("khanina hanya bisa membaca satu file sekaligus");
  }

  const [file] = positionals;
  const source = readSource(file);

  try {
    if (values.tokens) showTokens(source);
    if (values.ast) console.log(JSON.stringify(parse(tokenize(source)), null, 2));

    const { code } = compileWithSourceLines(source);
    if (values.out !== undefined) {
      if (resolve(values.out) === resolve(file)) {
        fail("--out tidak boleh menimpa file .khanina itu sendiri");
      }
      try {
        writeFileSync(values.out, code);
      } catch (error) {
        fail(`file "${values.out}" tidak bisa ditulis (${error.code ?? error.message})`);
      }
      console.log(`Saved the translated JavaScript to ${values.out}`);
    }
    if (values.tokens || values.ast || values.out !== undefined) return;

    runProgram(code, file);
  } catch (error) {
    if (!(error instanceof KhaninaError)) throw error;
    console.error(error.message);
    process.exitCode = 1;
  }
}

main();
