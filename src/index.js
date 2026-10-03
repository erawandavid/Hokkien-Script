import { tokenize } from "./lexer.js";
import { parse } from "./parser.js";
import { generate, generateWithSourceLines } from "./generator.js";

export { tokenize, parse, generate };
export { KhaninaError } from "./errors.js";

// Compiles Hokkien Script source code into a JavaScript source string.
export function compile(source) {
  return generate(parse(tokenize(source)));
}

// Like compile, but also returns which .khanina line each JavaScript line came from.
export function compileWithSourceLines(source) {
  return generateWithSourceLines(parse(tokenize(source)));
}
