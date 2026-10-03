# Hokkien Script Specification

Version: 0.1

Hokkien Script is a small programming language whose keywords are Hokkien
words written in casual Latin spelling. Hokkien Script files use the
`.khanina` extension. They are translated to JavaScript and run with Node.js
(version 20 or newer).

## 1. Dialect

- Spelling follows **Medan Hokkien**.
- The "ch" sound is written `c` (for example `ciak`, `co`, `cau`), not `ch`.
- Every keyword has exactly one official spelling. There are no alternative
  spellings yet.
- Keywords are all lowercase and case-sensitive: `kong` is a keyword, while
  `Kong` is an ordinary name.

## 2. Keywords

| Hokkien | Meaning | JavaScript |
|---|---|---|
| `u` | there is | `let` |
| `be pian` | does not change | `const` |
| `na si` | if | `if` |
| `na bo` | if not | `else` |
| `na bo na si` | if not, if | `else if` |
| `koh` | again | `while` |
| `cau` | run away | `break` |
| `tiau ke` | skip over | `continue` |
| `co` | make | `function` |
| `tui` | go back | `return` |
| `kong` | say | `console.log` |
| `si` | yes / true | `true` |
| `em si` | not | `false` |
| `bo` | nothing | `null` |

### Two-word keywords

`be pian`, `na si`, `na bo`, `em si`, and `tiau ke` are two-word keywords.
The rules are:

- The two words are separated by one or more spaces or tabs. If they are
  separated by a line break, they are not one keyword.
- The longest match always wins. `na bo na si` is read as `else if`, not as
  `else` followed by `if`.
- The first words (`be`, `na`, `em`, `tiau`) are not keywords on their own,
  so they can still be used as names. For example, `u em = 5` is valid.

### Word boundaries

Keywords are only recognized as whole words. The `kong` in `kongsi`, the
`si` in `sinar`, and the `u` in `umur` are not keywords. Text inside strings
and comments is never read as a keyword.

## 3. Syntax

### Lines and blocks

- One statement per line. A semicolon `;` is optional and can be used to put
  several statements on one line.
- Line breaks inside parentheses `( )` are ignored, so long argument lists
  can span several lines.
- Blocks use curly braces `{ }`. The bodies of `na si`, `na bo`, `koh`, and
  `co` must use curly braces, even when they hold a single line.
- The conditions of `na si` and `koh` must be in parentheses:
  `na si (x > 0)`.
- `na bo` and `na bo na si` can be on the same line as the `}` that closes
  the previous block, or on the next line.
- Indentation has no meaning.

### Comments

A comment starts with `//` and runs to the end of the line.

### Values

| Kind | Example | Notes |
|---|---|---|
| Number | `42`, `3.14` | Integers and decimals. Negative numbers are written with a leading `-`. |
| String | `"li ho"` | Double quotes only. Supported escapes: `\"`, `\\`, `\n`, `\t`. A string cannot contain a raw line break. |
| Boolean | `si`, `em si` | |
| Nothing | `bo` | |

### Names (identifiers)

- Made of the letters A–Z/a–z, digits, and `_`, and cannot start with a
  digit.
- Case-sensitive: `age` and `Age` are different names.
- Names that happen to clash with JavaScript words (such as `new`, `class`,
  or `console`) are allowed. In the translated JavaScript they automatically
  get a `$` prefix (for example `u new = 1` becomes `let $new = 1`).

### Operators

From the highest precedence to the lowest:

| Precedence | Operator | Notes |
|---|---|---|
| 1 | `( )`, `f(x)` | Grouping, function call |
| 2 | `!`, `-` | Unary not, negation |
| 3 | `*`, `/`, `%` | |
| 4 | `+`, `-` | `+` also joins strings |
| 5 | `<`, `>`, `<=`, `>=` | |
| 6 | `==`, `!=` | Translated to `===` and `!==` |
| 7 | `&&` | And |
| 8 | `\|\|` | Or |

Operators with the same precedence are evaluated left to right.

## 4. Statements

### Variables and constants

```
u age = 20          // variable, its value can change
u name              // no initial value, holds bo
be pian TAX = 0.11  // constant, must have an initial value

age = age + 1       // change a variable's value
```

- Assignment (`name = value`) is a statement, not an expression, so
  `na si (x = 1)` is an error.
- A variable lives in the block where it is created, just like `let` and
  `const` in JavaScript.
- Creating the same name twice in the same block, or changing the value of a
  `be pian`, is an error caught at compile time.
- Using a variable that was never created is an error caught when the
  program runs.

### Printing with `kong`

```
kong("li ho, dunia!")
kong("age:", age)   // several values are printed separated by spaces
kong()              // prints an empty line
```

- `kong` is used as a statement and must be followed by parentheses.
- `kong` prints values the Hokkien way: `si` prints as `si`, `em si` prints
  as `em si`, and `bo` prints as `bo`. The result of a function that returns
  nothing also prints as `bo`.
- Only values passed directly to `kong` are printed the Hokkien way. Once a
  value has been joined into a string, JavaScript rules apply:
  `kong("result: " + si)` prints `result: true`.

### Conditions: `na si`, `na bo na si`, `na bo`

```
na si (score >= 90) {
  kong("A")
} na bo na si (score >= 70) {
  kong("B")
} na bo {
  kong("C")
}
```

### Loops: `koh`, `cau`, `tiau ke`

```
u i = 0
koh (i < 10) {
  i = i + 1
  na si (i == 3) {
    tiau ke        // skip the rest of this round, go to the next one
  }
  na si (i == 6) {
    cau            // leave the loop
  }
  kong(i)
}
```

`cau` and `tiau ke` can only be used inside `koh`.

### Functions: `co` and `tui`

```
co add(a, b) {
  tui a + b
}

kong(add(1, 2))
```

- `tui` can only be used inside `co`.
- `tui` without a value (followed by a line break, `;`, or `}`) returns
  `bo`.
- Functions can call themselves (recursion) and can be created inside other
  blocks.
- A function call can stand alone as a statement or be used inside an
  expression.

## 5. Translated output

This program:

```
co add(a, b) {
  tui a + b
}

u i = 1
koh (i <= 3) {
  kong(add(i, 10))
  i = i + 1
}
```

is translated to JavaScript like this:

```js
"use strict";

function $kong(...values) {
  console.log(...values.map((v) => (v === true ? "si" : v === false ? "em si" : v == null ? "bo" : v)));
}

function add(a, b) {
  return a + b;
}

let i = 1;
while (i <= 3) {
  $kong(add(i, 10));
  i = i + 1;
}
```

The output always starts with `"use strict";`, so assigning to a name that
was never created is an error however the JavaScript file is run. The `$kong`
helper is only added when the program uses `kong`. Names that
start with `$` can never clash with user names, because `$` is not allowed in
Hokkien Script names.

## 6. Error messages

Every error uses this format:

```
paiseh, baris 3 kolom 5: kurung kurawal belum ditutup
```

(`baris` = line, `kolom` = column; the example means "the curly brace was
never closed".) The format applies to errors while reading the code (lexer),
while building the syntax tree (parser), and while using the CLI (file not
found, extension is not `.khanina`).

Errors raised while the program runs also get the `paiseh` prefix. They show
the `.khanina` line where they happened, without a column, and common
JavaScript errors are translated:

```
paiseh, baris 4: "x" belum dibuat
```

The `khanina` command prints the offending source line under the message,
with a `^` under the column when there is one.

## 7. Out of scope for the MVP

The first version does not have: arrays, objects, `for` loops, user input,
importing other files, single-quoted strings, compound operators such as
`+=`, alternative keyword spellings, or Hokkien aliases for the logical
operators.
