// Turns tokens from the lexer into an abstract syntax tree (AST).
//
// The parser is a recursive descent parser. Besides building the tree, it
// performs the compile-time checks from SPEC.md: names created twice in the
// same block, assigning to a `be pian`, and `tui`, `cau`, or `tiau ke` used
// outside the place they belong.
//
// Every node has a `type`, plus `line` and `column` pointing at the token
// where the node starts.
//
// Statements:
//   Program             { body }
//   VariableDeclaration { kind: "u" | "be pian", name, init }
//   Assignment          { name, value }
//   Print               { args }
//   If                  { test, consequent: Block, alternate: If | Block | null }
//   While               { test, body: Block }
//   Break, Continue     {}
//   FunctionDeclaration { name, params, body: Block }
//   Return              { argument }
//   ExpressionStatement { expression: Call }
//   Block               { body }
// Expressions:
//   Literal             { value }  number, string, true, false, or null
//   Identifier          { name }
//   Unary               { operator, argument }
//   Binary              { operator, left, right }
//   Call                { callee, args }

import { KhaninaError } from "./errors.js";

const BINARY_LEVELS = [
  ["||"],
  ["&&"],
  ["==", "!="],
  ["<", ">", "<=", ">="],
  ["+", "-"],
  ["*", "/", "%"],
];

const LITERAL_KEYWORDS = { si: true, "em si": false, bo: null };

function describe(token) {
  switch (token.type) {
    case "eof":
      return "akhir file";
    case "newline":
      return "baris baru";
    case "keyword":
      return `keyword "${token.value}"`;
    case "identifier":
      return `nama "${token.value}"`;
    case "number":
      return `angka ${token.value}`;
    case "string":
      return `string ${JSON.stringify(token.value)}`;
    default:
      return `"${token.value}"`;
  }
}

// Options, used by the interactive prompt (REPL):
//   globals               a Map used as the top-level scope, so names created
//                         by earlier inputs are known; new names are added to it
//   allowBareExpressions  accept statements such as `1 + 2` whose result is not used
export function parse(tokens, { globals = new Map(), allowBareExpressions = false } = {}) {
  let index = 0;
  let functionDepth = 0;
  let loopDepth = 0;
  // Each scope maps a name to how it was created: "u", "be pian", "co", or "parameter".
  const scopes = [globals];

  const peek = () => tokens[index];
  const next = () => tokens[index++];
  const is = (type, value) => {
    const token = peek();
    return token.type === type && (value === undefined || token.value === value);
  };
  const isPunct = (value) => is("punctuation", value);
  const isKeyword = (value) => is("keyword", value);

  const fail = (message, token = peek()) => {
    throw new KhaninaError(message, token.line, token.column);
  };

  const node = (type, token, fields) => ({ type, ...fields, line: token.line, column: token.column });

  const expectPunct = (value, opener = null) => {
    if (isPunct(value)) return next();
    if (opener && is("eof")) {
      fail(value === "}" ? "kurung kurawal belum ditutup" : "kurung belum ditutup", opener);
    }
    return fail(`seharusnya "${value}" di sini, bukan ${describe(peek())}`);
  };

  const expectName = (what) => {
    if (is("identifier")) return next();
    return fail(`seharusnya ${what} di sini, bukan ${describe(peek())}`);
  };

  const skipSeparators = () => {
    while (is("newline") || isPunct(";")) next();
  };

  // --- scopes -------------------------------------------------------------

  const declare = (nameToken, kind) => {
    const scope = scopes[scopes.length - 1];
    if (scope.has(nameToken.value)) {
      fail(`"${nameToken.value}" sudah dibuat di blok ini`, nameToken);
    }
    scope.set(nameToken.value, kind);
  };

  const lookup = (name) => {
    for (let i = scopes.length - 1; i >= 0; i--) {
      if (scopes[i].has(name)) return scopes[i].get(name);
    }
    return null;
  };

  const withScope = (callback) => {
    scopes.push(new Map());
    try {
      return callback();
    } finally {
      scopes.pop();
    }
  };

  // --- statements ---------------------------------------------------------

  const parseProgram = () => {
    const first = peek();
    const body = [];
    skipSeparators();
    while (!is("eof")) {
      if (isPunct("}")) fail('kurung kurawal "}" tidak punya pasangan');
      body.push(parseStatement());
      endStatement();
      skipSeparators();
    }
    return node("Program", first, { body });
  };

  // Every statement must be followed by a line break, ";", "}" or the end of the file.
  const endStatement = () => {
    if (is("newline") || isPunct(";") || isPunct("}") || is("eof")) return;
    fail(`seharusnya ganti baris sebelum ${describe(peek())}`);
  };

  // Parses `{ ... }`. The caller decides whether the block gets its own scope.
  const parseBlockBody = () => {
    const open = expectPunct("{");
    const body = [];
    skipSeparators();
    while (!isPunct("}")) {
      if (is("eof")) fail("kurung kurawal belum ditutup", open);
      body.push(parseStatement());
      endStatement();
      skipSeparators();
    }
    next();
    return node("Block", open, { body });
  };

  const parseBlock = () => withScope(parseBlockBody);

  const parseStatement = () => {
    const token = peek();
    if (token.type === "keyword") {
      switch (token.value) {
        case "u":
        case "be pian":
          return parseDeclaration();
        case "na si":
          return parseIf();
        case "na bo":
        case "na bo na si":
          return fail(`${token.value} harus ditulis setelah blok na si`);
        case "koh":
          return parseWhile();
        case "cau":
        case "tiau ke":
          return parseLoopControl();
        case "co":
          return parseFunction();
        case "tui":
          return parseReturn();
        case "kong":
          return parsePrint();
      }
    }
    if (token.type === "identifier" && tokens[index + 1].type === "operator" && tokens[index + 1].value === "=") {
      return parseAssignment();
    }
    return parseExpressionStatement();
  };

  const parseDeclaration = () => {
    const keyword = next();
    const name = expectName("nama variabel");
    let init = null;
    if (is("operator", "=")) {
      next();
      init = parseExpression();
    } else if (keyword.value === "be pian") {
      fail(`be pian "${name.value}" harus punya nilai awal`, name);
    }
    declare(name, keyword.value);
    return node("VariableDeclaration", keyword, { kind: keyword.value, name: name.value, init });
  };

  const parseAssignment = () => {
    const name = next();
    next(); // =
    if (lookup(name.value) === "be pian") {
      fail(`"${name.value}" itu be pian, nilainya tidak bisa diubah`, name);
    }
    const value = parseExpression();
    return node("Assignment", name, { name: name.value, value });
  };

  const parseCondition = () => {
    const open = expectPunct("(");
    const test = parseExpression();
    expectPunct(")", open);
    return test;
  };

  const parseIf = () => {
    const keyword = next();
    const test = parseCondition();
    const consequent = parseBlock();
    let alternate = null;

    // `na bo` may sit on the line after the closing brace.
    const afterBlock = index;
    while (is("newline")) next();
    if (isKeyword("na bo na si")) {
      alternate = parseIf();
    } else if (isKeyword("na bo")) {
      next();
      alternate = parseBlock();
    } else {
      index = afterBlock;
    }
    return node("If", keyword, { test, consequent, alternate });
  };

  const parseWhile = () => {
    const keyword = next();
    const test = parseCondition();
    loopDepth++;
    try {
      const body = parseBlock();
      return node("While", keyword, { test, body });
    } finally {
      loopDepth--;
    }
  };

  const parseLoopControl = () => {
    const keyword = next();
    if (loopDepth === 0) fail(`${keyword.value} hanya boleh dipakai di dalam koh`, keyword);
    return node(keyword.value === "cau" ? "Break" : "Continue", keyword, {});
  };

  const parseFunction = () => {
    const keyword = next();
    const name = expectName("nama fungsi");
    declare(name, "co");

    const open = expectPunct("(");
    const params = [];
    if (!isPunct(")")) {
      params.push(expectName("nama parameter"));
      while (isPunct(",")) {
        next();
        params.push(expectName("nama parameter"));
      }
    }
    expectPunct(")", open);

    const savedLoopDepth = loopDepth;
    loopDepth = 0;
    functionDepth++;
    try {
      const body = withScope(() => {
        for (const param of params) {
          if (scopes.at(-1).has(param.value)) fail(`parameter "${param.value}" ditulis dua kali`, param);
          declare(param, "parameter");
        }
        return parseBlockBody();
      });
      return node("FunctionDeclaration", keyword, {
        name: name.value,
        params: params.map((param) => param.value),
        body,
      });
    } finally {
      functionDepth--;
      loopDepth = savedLoopDepth;
    }
  };

  const parseReturn = () => {
    const keyword = next();
    if (functionDepth === 0) fail("tui hanya boleh dipakai di dalam co", keyword);
    let argument = null;
    if (!(is("newline") || isPunct(";") || isPunct("}") || is("eof"))) {
      argument = parseExpression();
    }
    return node("Return", keyword, { argument });
  };

  const parsePrint = () => {
    const keyword = next();
    if (!isPunct("(")) fail(`seharusnya "(" setelah kong, bukan ${describe(peek())}`);
    const args = parseArguments();
    return node("Print", keyword, { args });
  };

  const parseExpressionStatement = () => {
    const start = peek();
    const expression = parseExpression();
    if (is("operator", "=")) {
      fail("yang bisa diberi nilai hanya nama variabel", start);
    }
    if (expression.type === "Call" || allowBareExpressions) {
      return node("ExpressionStatement", start, { expression });
    }
    if (expression.type === "Binary" && expression.operator === "==" && expression.left.type === "Identifier") {
      fail('hasil perbandingan ini tidak dipakai, maksudnya "=" untuk mengubah nilai?', start);
    }
    return fail("hasil ekspresi ini tidak dipakai", start);
  };

  // --- expressions --------------------------------------------------------

  const parseExpression = () => parseBinary(0);

  const parseBinary = (level) => {
    if (level === BINARY_LEVELS.length) return parseUnary();
    const operators = BINARY_LEVELS[level];
    let left = parseBinary(level + 1);
    while (is("operator") && operators.includes(peek().value)) {
      const operator = next();
      const right = parseBinary(level + 1);
      left = { type: "Binary", operator: operator.value, left, right, line: left.line, column: left.column };
    }
    return left;
  };

  const parseUnary = () => {
    if (is("operator", "!") || is("operator", "-")) {
      const operator = next();
      const argument = parseUnary();
      return node("Unary", operator, { operator: operator.value, argument });
    }
    return parseCall();
  };

  const parseArguments = () => {
    const open = expectPunct("(");
    const args = [];
    if (!isPunct(")")) {
      args.push(parseExpression());
      while (isPunct(",")) {
        next();
        args.push(parseExpression());
      }
    }
    if (!isPunct(")")) {
      if (is("eof")) fail("kurung belum ditutup", open);
      fail(`seharusnya "," atau ")" di sini, bukan ${describe(peek())}`);
    }
    next();
    return args;
  };

  const parseCall = () => {
    let expression = parsePrimary();
    while (isPunct("(")) {
      const args = parseArguments();
      expression = { type: "Call", callee: expression, args, line: expression.line, column: expression.column };
    }
    return expression;
  };

  const parsePrimary = () => {
    const token = peek();
    switch (token.type) {
      case "number":
      case "string":
        next();
        return node("Literal", token, { value: token.value });
      case "identifier":
        next();
        return node("Identifier", token, { name: token.value });
      case "keyword":
        if (Object.hasOwn(LITERAL_KEYWORDS, token.value)) {
          next();
          return node("Literal", token, { value: LITERAL_KEYWORDS[token.value] });
        }
        if (token.value === "kong") {
          return fail("kong tidak menghasilkan nilai, pakai sebagai statement saja", token);
        }
        break;
      case "punctuation":
        if (token.value === "(") {
          next();
          const expression = parseExpression();
          expectPunct(")", token);
          return expression;
        }
        break;
    }
    return fail(`seharusnya ada nilai di sini, bukan ${describe(token)}`, token);
  };

  return parseProgram();
}
