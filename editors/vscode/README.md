# Hokkien Script for Visual Studio Code

Syntax highlighting and snippets for [Hokkien Script](https://github.com/erawandavid/Hokkien-Script)
(`.khanina`) files.

## Features

- Highlighting for every keyword, including the two-word ones (`na si`,
  `na bo na si`, `be pian`, `em si`, `tiau ke`), plus strings, numbers,
  comments, and function names
- `//` comments with the Toggle Line Comment shortcut (Ctrl+/ or ⌘+/)
- Auto-closing `{ }`, `( )`, and `" "`, and indentation after `{`
- Snippets:

  | Type | You get |
  |---|---|
  | `nasi` | `na si (...) { }` |
  | `nasinabo` | `na si (...) { } na bo { }` |
  | `nabonasi` | `na bo na si (...) { }` |
  | `koh` | `koh (...) { }` |
  | `co` | `co name(...) { }` |
  | `kong` | `kong(...)` |

## Installation

The extension is not on the Visual Studio Marketplace yet. To install it
from this repository, package it and install the `.vsix` file:

```sh
cd editors/vscode
npx @vscode/vsce package
code --install-extension hokkien-script-0.1.0.vsix
```

You can also install the `.vsix` file from VS Code itself: open the
Extensions view, click `...` at the top, and choose **Install from VSIX...**.

Restart VS Code, then open any `.khanina` file.
