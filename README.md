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

> **Status:** work in progress. The language design is final
> ([SPEC.md](SPEC.md)); the compiler and the `khanina` command are still
> being built.

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

The full language rules are in [SPEC.md](SPEC.md), and example programs are
in [examples/](examples).

## Requirements

- Node.js 20 or newer

## Development

```sh
git clone https://github.com/erawandavid/Hokkien-Script.git
cd Hokkien-Script
npm test
```

The compiler has no dependencies outside Node.js itself.

## License

[MIT](LICENSE)
