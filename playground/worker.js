// Runs a Hokkien Script program off the page's main thread, so an endless
// loop cannot freeze the page (the page stops this worker after a timeout).
//
// Receives { source } and posts back, in order:
//   { type: "output", lines }                          printed lines, in batches
//   { type: "error", message, line, column, phase }    at most one error
//   { type: "done" }

import { compileWithSourceLines, KhaninaError } from "../src/index.js";
import { formatMessage, runtimeMessage, runtimeLine } from "../src/errors.js";

const PROGRAM_NAME = "khanina-program.js";
const BATCH_SIZE = 200;
const MAX_LINES = 5000;

// Browsers add a few lines of their own above a `new Function` body. Measure
// how many by throwing from a known line, so stack trace lines can be mapped
// back to the generated code.
const LINE_OFFSET = (() => {
  try {
    new Function("console", `"use strict";\nthrow new Error("probe");\n//# sourceURL=${PROGRAM_NAME}`)();
  } catch (error) {
    const match = String(error.stack).match(/khanina-program\.js:(\d+)/);
    if (match) return Number(match[1]) - 2;
  }
  return null;
})();

class TooMuchOutput extends Error {}

// Matches how Node.js prints the values that reach console.log through $kong.
const show = (value) => (typeof value === "function" ? `[Function: ${value.name}]` : String(value));

self.onmessage = ({ data: { source } }) => {
  let pending = [];
  let printed = 0;
  const flush = () => {
    if (pending.length > 0) self.postMessage({ type: "output", lines: pending });
    pending = [];
  };
  const programConsole = {
    log: (...values) => {
      if (printed >= MAX_LINES) throw new TooMuchOutput();
      printed++;
      pending.push(values.map(show).join(" "));
      if (pending.length >= BATCH_SIZE) flush();
    },
  };

  try {
    let compiled;
    try {
      compiled = compileWithSourceLines(source);
    } catch (error) {
      if (!(error instanceof KhaninaError)) throw error;
      self.postMessage({ type: "error", phase: "compile", message: error.message, line: error.line, column: error.column });
      return;
    }

    try {
      new Function("console", `${compiled.code}//# sourceURL=${PROGRAM_NAME}`)(programConsole);
    } catch (error) {
      flush();
      if (error instanceof TooMuchOutput) {
        const message = formatMessage(`output terlalu banyak, program dihentikan setelah ${MAX_LINES} baris`);
        self.postMessage({ type: "error", phase: "run", message, line: null, column: null });
        return;
      }
      let sourceLines = [];
      if (LINE_OFFSET !== null) {
        sourceLines =
          LINE_OFFSET >= 0
            ? [...Array(LINE_OFFSET).fill(null), ...compiled.sourceLines]
            : compiled.sourceLines.slice(-LINE_OFFSET);
      }
      const line = runtimeLine(error, PROGRAM_NAME, sourceLines);
      self.postMessage({ type: "error", phase: "run", message: formatMessage(runtimeMessage(error), line), line, column: null });
    }
  } finally {
    flush();
    self.postMessage({ type: "done" });
  }
};
