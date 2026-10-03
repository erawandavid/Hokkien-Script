// Turns the AST from the parser into readable JavaScript.

// Names that cannot be used as-is in JavaScript, or that would hide something
// the generated code relies on. They get a `$` prefix, which can never clash
// with a Hokkien Script name because `$` is not allowed in names.
const RESERVED = new Set([
  "arguments", "await", "break", "case", "catch", "class", "console", "const", "continue",
  "debugger", "default", "delete", "do", "else", "enum", "eval", "export", "extends",
  "false", "finally", "for", "function", "if", "implements", "import", "in", "Infinity",
  "instanceof", "interface", "let", "NaN", "new", "null", "package", "private",
  "protected", "public", "return", "static", "super", "switch", "this", "throw", "true",
  "try", "typeof", "undefined", "var", "void", "while", "with", "yield",
]);

export const jsName = (name) => (RESERVED.has(name) ? `$${name}` : name);

const BINARY_PRECEDENCE = {
  "||": 1,
  "&&": 2,
  "==": 3,
  "!=": 3,
  "<": 4,
  ">": 4,
  "<=": 4,
  ">=": 4,
  "+": 5,
  "-": 5,
  "*": 6,
  "/": 6,
  "%": 6,
};
const UNARY_PRECEDENCE = 7;
const ATOM_PRECEDENCE = 8;

const JS_OPERATORS = { "==": "===", "!=": "!==" };

const KONG_HELPER = [
  "function $kong(...values) {",
  '  console.log(...values.map((v) => (v === true ? "si" : v === false ? "em si" : v == null ? "bo" : v)));',
  "}",
];

const INDENT = "  ";

const precedenceOf = (expr) => {
  if (expr.type === "Binary") return BINARY_PRECEDENCE[expr.operator];
  if (expr.type === "Unary") return UNARY_PRECEDENCE;
  return ATOM_PRECEDENCE;
};

function expression(expr) {
  switch (expr.type) {
    case "Literal":
      if (typeof expr.value === "string") return JSON.stringify(expr.value);
      return String(expr.value);
    case "Identifier":
      return jsName(expr.name);
    case "Unary": {
      let argument = expression(expr.argument);
      // Parenthesize lower-precedence operands, and keep `- -x` from turning into `--x`.
      if (precedenceOf(expr.argument) < UNARY_PRECEDENCE || (expr.operator === "-" && argument.startsWith("-"))) {
        argument = `(${argument})`;
      }
      return `${expr.operator}${argument}`;
    }
    case "Binary": {
      const precedence = BINARY_PRECEDENCE[expr.operator];
      let left = expression(expr.left);
      let right = expression(expr.right);
      // Operators are left-associative, so an equal-precedence right operand needs parentheses.
      if (precedenceOf(expr.left) < precedence) left = `(${left})`;
      if (precedenceOf(expr.right) <= precedence) right = `(${right})`;
      return `${left} ${JS_OPERATORS[expr.operator] ?? expr.operator} ${right}`;
    }
    case "Call":
      return `${expression(expr.callee)}(${expr.args.map(expression).join(", ")})`;
  }
  throw new Error(`unknown expression type: ${expr.type}`);
}

// Generates JavaScript and records, for every output line, the line in the
// .khanina source it came from (or null for lines such as closing braces).
// Returns { code, sourceLines } where sourceLines[i] belongs to output line i + 1.
export function generateWithSourceLines(ast) {
  const lines = [];
  let usesKong = false;

  const emit = (depth, text, node = null) => {
    lines.push({ text: INDENT.repeat(depth) + text, line: node ? node.line : null });
  };
  const blank = () => {
    if (lines.length > 0 && lines[lines.length - 1].text !== "") lines.push({ text: "", line: null });
  };

  const statements = (body, depth) => {
    body.forEach((stmt, i) => {
      const isFunction = stmt.type === "FunctionDeclaration";
      if (isFunction && i > 0) blank();
      statement(stmt, depth);
      if (isFunction && i < body.length - 1) blank();
    });
  };

  const statement = (stmt, depth) => {
    switch (stmt.type) {
      case "VariableDeclaration": {
        const keyword = stmt.kind === "be pian" ? "const" : "let";
        const init = stmt.init ? expression(stmt.init) : "null";
        emit(depth, `${keyword} ${jsName(stmt.name)} = ${init};`, stmt);
        return;
      }
      case "Assignment":
        emit(depth, `${jsName(stmt.name)} = ${expression(stmt.value)};`, stmt);
        return;
      case "Print":
        usesKong = true;
        emit(depth, `$kong(${stmt.args.map(expression).join(", ")});`, stmt);
        return;
      case "If": {
        let current = stmt;
        emit(depth, `if (${expression(current.test)}) {`, current);
        for (;;) {
          statements(current.consequent.body, depth + 1);
          const alternate = current.alternate;
          if (alternate === null) {
            emit(depth, "}");
            return;
          }
          if (alternate.type === "If") {
            emit(depth, `} else if (${expression(alternate.test)}) {`, alternate);
            current = alternate;
            continue;
          }
          emit(depth, "} else {", alternate);
          statements(alternate.body, depth + 1);
          emit(depth, "}");
          return;
        }
      }
      case "While":
        emit(depth, `while (${expression(stmt.test)}) {`, stmt);
        statements(stmt.body.body, depth + 1);
        emit(depth, "}");
        return;
      case "Break":
        emit(depth, "break;", stmt);
        return;
      case "Continue":
        emit(depth, "continue;", stmt);
        return;
      case "FunctionDeclaration":
        emit(depth, `function ${jsName(stmt.name)}(${stmt.params.map(jsName).join(", ")}) {`, stmt);
        statements(stmt.body.body, depth + 1);
        emit(depth, "}");
        return;
      case "Return":
        emit(depth, stmt.argument ? `return ${expression(stmt.argument)};` : "return;", stmt);
        return;
      case "ExpressionStatement":
        emit(depth, `${expression(stmt.expression)};`, stmt);
        return;
    }
    throw new Error(`unknown statement type: ${stmt.type}`);
  };

  statements(ast.body, 0);

  const header = ['"use strict";', ""];
  if (usesKong) header.push(...KONG_HELPER, "");
  const all = [...header.map((text) => ({ text, line: null })), ...lines];
  while (all.length > 0 && all[all.length - 1].text === "") all.pop();

  return {
    code: `${all.map((entry) => entry.text).join("\n")}\n`,
    sourceLines: all.map((entry) => entry.line),
  };
}

export function generate(ast) {
  return generateWithSourceLines(ast).code;
}
