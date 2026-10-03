# Hokkien Script

for you all hokkien people siao a

Hokkien Script is a small programming language whose keywords are Hokkien,
written in the casual Latin spelling used in Medan. Programs are saved as
`.khanina` files, compiled to JavaScript, and run with Node.js.

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

```console
$ khanina hitung.khanina
11
12
13
```

## Installation

You need [Node.js](https://nodejs.org) 20 or newer. Hokkien Script has no
other dependencies.

Install the `khanina` command straight from GitHub:

```sh
npm install -g github:erawandavid/Hokkien-Script
```

Or clone the repository and link it, which is handy if you want to change
the compiler:

```sh
git clone https://github.com/erawandavid/Hokkien-Script.git
cd Hokkien-Script
npm link
```

## Running a program

Save this as `halo.khanina`:

```
kong("li ho, dunia!")
```

and run it:

```console
$ khanina halo.khanina
li ho, dunia!
```

Other options:

| Command | What it does |
|---|---|
| `khanina file.khanina` | Run the program |
| `khanina file.khanina --out file.js` | Save the translated JavaScript instead of running it |
| `khanina file.khanina --tokens` | Show the tokens the lexer produces |
| `khanina file.khanina --ast` | Show the syntax tree the parser produces |
| `khanina --help` | Show help |

Files must use the `.khanina` extension. Without installing, you can also
run `node bin/khanina.js file.khanina` from the repository folder.

## Keywords

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

Keywords are lowercase. Two-word keywords such as `na si` are written with a
space between the words.

## A short tour

```
// Variables and constants
u umur = 20
be pian BATAS = 17

// Conditions
na si (umur >= BATAS) {
  kong("lu boleh masuk")
} na bo na si (umur >= 13) {
  kong("tunggu sebentar lagi")
} na bo {
  kong("paiseh, belum boleh")
}

// Loops: cau leaves the loop, tiau ke skips to the next round
u i = 0
koh (i < 10) {
  i = i + 1
  na si (i % 2 == 0) {
    tiau ke
  }
  na si (i > 7) {
    cau
  }
  kong(i)
}

// Functions
co faktorial(n) {
  na si (n <= 1) {
    tui 1
  }
  tui n * faktorial(n - 1)
}
kong("5! =", faktorial(5))

// kong prints true, false and null the Hokkien way
kong(si, em si, bo)   // si em si bo
```

The full language rules are in [SPEC.md](SPEC.md), and more example programs
are in [examples/](examples).

## Error messages

Errors are written in Indonesian with a Hokkien `paiseh` ("sorry"), and point
at the line and column of the problem:

```console
$ khanina salah.khanina
paiseh, baris 2 kolom 12: kurung kurawal belum ditutup
  2 | na si (si) {
    |            ^
```

(`baris` = line, `kolom` = column; this one says the curly brace was never
closed.)

## Development

```sh
npm test
```

The compiler is in [src/](src): `lexer.js` turns source code into tokens,
`parser.js` builds a syntax tree, and `generator.js` writes JavaScript. The
`khanina` command lives in [bin/khanina.js](bin/khanina.js).

## License

[MIT](LICENSE)
