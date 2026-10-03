import { tokenize } from "./lexer.js";
import { parse } from "./parser.js";
import { generate } from "./generator.js";

export { KhaninaError } from "./errors.js";

// Compiles Hokkien Script source code into a JavaScript source string.
export function compile(source) {
  return generate(parse(tokenize(source)));
}
