// The interactive prompt that opens when `khanina` runs without a file.
//
// Every input is compiled and run in one shared context, so names created in
// one input can be used in the next. An input with an unclosed `{` or `(`
// continues on the next line. A bare expression such as `1 + 2` prints its
// value.

import repl from "node:repl";
import vm from "node:vm";
import { Console } from "node:console";
import { inspect } from "node:util";
import { tokenize } from "./lexer.js";
import { parse } from "./parser.js";
import { generateWithSourceLines } from "./generator.js";
import { KhaninaError, formatMessage, codeFrame, runtimeMessage, runtimeLine } from "./errors.js";

// Used as the file name of each input, so its frames can be found in stack traces.
const INPUT_NAME = "khanina-repl-input";

const isIncomplete = (error) =>
  error instanceof KhaninaError &&
  (error.detail === "kurung kurawal belum ditutup" ||
    error.detail === "kurung belum ditutup" ||
    error.detail.endsWith("bukan akhir file"));

// A top-level `u` or `be pian` whose initial value fails can never be created
// again in the same session (JavaScript keeps the name reserved). To avoid
// that trap, names used in those initial values are checked before running.
function checkInitialValues(ast, names) {
  const visit = (expr) => {
    switch (expr.type) {
      case "Identifier":
        if (!names.has(expr.name)) {
          throw new KhaninaError(`"${expr.name}" belum dibuat`, expr.line, expr.column);
        }
        return;
      case "Unary":
        return visit(expr.argument);
      case "Binary":
        visit(expr.left);
        return visit(expr.right);
      case "Call":
        visit(expr.callee);
        return expr.args.forEach(visit);
    }
  };
  for (const stmt of ast.body) {
    if (stmt.type === "VariableDeclaration" && stmt.init) visit(stmt.init);
  }
}

export function startRepl({ input = process.stdin, output = process.stdout, version = "" } = {}) {
  const useColors = Boolean(output.isTTY);
  const programConsole = new Console({ stdout: output, stderr: output });
  let context;
  let names;

  const reset = () => {
    context = vm.createContext({ console: programConsole });
    names = new Map();
  };
  reset();

  const report = (message, source, line, column = null) => {
    const frame = line == null ? "" : codeFrame(source, line, column);
    output.write(`${message}\n${frame ? `${frame}\n` : ""}`);
  };

  const formatValue = (value) => {
    if (value === true) return "si";
    if (value === false) return "em si";
    if (value == null) return "bo";
    if (typeof value === "string") return JSON.stringify(value);
    return inspect(value, { colors: useColors });
  };

  const evaluate = (command, _context, _filename, callback) => {
    const source = command.replace(/\r?\n$/, "");
    if (source.trim() === "") return callback(null);

    let ast;
    let compiled;
    const scope = new Map(names);
    try {
      ast = parse(tokenize(source), { globals: scope, allowBareExpressions: true });
      checkInitialValues(ast, scope);
      compiled = generateWithSourceLines(ast);
    } catch (error) {
      if (isIncomplete(error)) return callback(new repl.Recoverable(error));
      if (!(error instanceof KhaninaError)) return callback(error);
      report(error.message, source, error.line, error.column);
      return callback(null);
    }

    // JavaScript creates the names before the input runs, even if it fails.
    names = scope;
    let value;
    try {
      value = vm.runInContext(compiled.code, context, { filename: INPUT_NAME });
    } catch (error) {
      const line = runtimeLine(error, INPUT_NAME, compiled.sourceLines);
      report(formatMessage(runtimeMessage(error), line), source, line);
      return callback(null);
    }

    const last = ast.body[ast.body.length - 1];
    return callback(null, last && last.type === "ExpressionStatement" ? value : undefined);
  };

  output.write(`li ho! Hokkien Script ${version}\nType .help for help, .exit to quit.\n`);
  const server = repl.start({
    prompt: "khanina> ",
    input,
    output,
    eval: evaluate,
    writer: formatValue,
    ignoreUndefined: true,
    useColors,
  });
  server.on("reset", reset);
  return server;
}
