import { compile, KhaninaError } from "../src/index.js";
import { codeFrame } from "../src/errors.js";

const TIMEOUT_MS = 5000;

const DEFAULT_PROGRAM = `// li ho! Edit this program and press Run.
co tambah(a, b) {
  tui a + b
}

u i = 1
koh (i <= 3) {
  kong("i =", i, "->", tambah(i, 10))
  i = i + 1
}

na si (i > 3) {
  kong("selesai, kamsia!")
}
`;

const $ = (id) => document.getElementById(id);
const source = $("source");
const highlight = $("highlight");
const gutter = $("gutter");
const output = $("output");
const javascript = $("javascript");
const status = $("status");

if (/Mac|iPhone|iPad/.test(navigator.platform)) {
  $("hint").textContent = "⌘+Enter to run";
  $("run").title = "Run (⌘+Enter)";
}

// --- syntax highlighting -------------------------------------------------

const TOKEN = new RegExp(
  [
    String.raw`(?<comment>\/\/[^\n]*)`,
    String.raw`(?<string>"(?:[^"\\\n]|\\.)*"?)`,
    String.raw`(?<control>\b(?:na[ \t]+bo[ \t]+na[ \t]+si|na[ \t]+si|na[ \t]+bo|tiau[ \t]+ke|koh|cau|tui)\b)`,
    String.raw`(?<decl>\b(?:be[ \t]+pian|u|co)\b)`,
    String.raw`(?<builtin>\bkong\b)`,
    String.raw`(?<constant>\b(?:em[ \t]+si|si|bo)\b)`,
    String.raw`(?<number>\b\d+(?:\.\d+)?\b)`,
    String.raw`(?<function>\b[A-Za-z_]\w*(?=[ \t]*\())`,
  ].join("|"),
  "g",
);

const escapeHtml = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function highlightCode(text) {
  let html = "";
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    const kind = Object.keys(match.groups).find((name) => match.groups[name] !== undefined);
    html += escapeHtml(text.slice(last, match.index));
    html += `<span class="syn-${kind}">${escapeHtml(match[0])}</span>`;
    last = match.index + match[0].length;
  }
  return html + escapeHtml(text.slice(last));
}

let errorLine = null;

function renderEditor() {
  const text = source.value;
  // Extra blank lines let the copies scroll as far as the textarea can.
  highlight.innerHTML = `${highlightCode(text)}\n\n\n`;
  const count = text.split("\n").length;
  let numbers = "";
  for (let line = 1; line <= count; line++) {
    numbers += line === errorLine ? `<span class="error-line">${line}</span>\n` : `${line}\n`;
  }
  gutter.innerHTML = `${numbers}\n\n`;
  syncScroll();
}

function syncScroll() {
  highlight.scrollTop = source.scrollTop;
  highlight.scrollLeft = source.scrollLeft;
  gutter.scrollTop = source.scrollTop;
}

// --- editing helpers -----------------------------------------------------

function insertText(text) {
  // execCommand keeps the browser's undo history; setRangeText is the fallback.
  if (!document.execCommand("insertText", false, text)) {
    source.setRangeText(text, source.selectionStart, source.selectionEnd, "end");
    source.dispatchEvent(new Event("input"));
  }
}

source.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    run();
    return;
  }
  if (event.key === "Tab" && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
    event.preventDefault();
    insertText("  ");
    return;
  }
  if (event.key === "Enter" && !event.shiftKey && !event.altKey) {
    // Keep the current indentation, and indent one more level after "{".
    const before = source.value.slice(0, source.selectionStart);
    const currentLine = before.slice(before.lastIndexOf("\n") + 1);
    let indent = currentLine.match(/^[ \t]*/)[0];
    if (/\{\s*$/.test(currentLine)) indent += "  ";
    event.preventDefault();
    insertText(`\n${indent}`);
  }
});

let compileTimer = null;
source.addEventListener("input", () => {
  errorLine = null;
  renderEditor();
  clearTimeout(compileTimer);
  compileTimer = setTimeout(showJavaScript, 150);
});
source.addEventListener("scroll", syncScroll);

// --- JavaScript tab ------------------------------------------------------

function errorText(error, text) {
  const frame = error.line == null ? "" : codeFrame(text, error.line, error.column);
  return frame ? `${error.message}\n${frame}` : error.message;
}

function showJavaScript() {
  const text = source.value;
  try {
    javascript.textContent = compile(text);
  } catch (error) {
    if (!(error instanceof KhaninaError)) throw error;
    javascript.replaceChildren(block("error", errorText(error, text)));
  }
}

// --- running -------------------------------------------------------------

function block(className, text) {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  return span;
}

let worker = null;
let timer = null;
let startedAt = 0;
let runningSource = "";
let printedSomething = false;

function startWorker() {
  worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
  worker.onmessage = ({ data }) => {
    if (data.type === "output") {
      printedSomething = true;
      output.append(block("lines", data.lines.join("\n")));
    } else if (data.type === "error") {
      printedSomething = true;
      output.append(block("error", errorText(data, runningSource)));
      if (data.line != null) {
        errorLine = data.line;
        renderEditor();
      }
    } else if (data.type === "done") {
      finish(`Done in ${Math.round(performance.now() - startedAt)} ms`);
    }
  };
  worker.onerror = (event) => {
    event.preventDefault();
    stopWorker();
    output.append(
      block(
        "error",
        "The playground could not start its runner. Open it through a web server such as GitHub Pages, not as a local file.",
      ),
    );
    finish("Stopped");
  };
}

function stopWorker() {
  if (worker) worker.terminate();
  worker = null;
}

function finish(message) {
  clearTimeout(timer);
  timer = null;
  if (!printedSomething) output.replaceChildren(block("placeholder", "(no output)"));
  status.textContent = message;
}

function run() {
  if (timer !== null) stopWorker(); // a previous run is still going
  if (!worker) startWorker();
  showTab("output");
  output.replaceChildren();
  printedSomething = false;
  errorLine = null;
  renderEditor();
  status.textContent = "Running…";
  runningSource = source.value;
  startedAt = performance.now();
  worker.postMessage({ source: runningSource });
  timer = setTimeout(() => {
    stopWorker();
    printedSomething = true;
    output.append(
      block(
        "error",
        `paiseh, program berjalan lebih dari ${TIMEOUT_MS / 1000} detik dan dihentikan, mungkin perulangannya tidak pernah berhenti`,
      ),
    );
    finish("Stopped");
  }, TIMEOUT_MS);
}

$("run").addEventListener("click", run);

// --- tabs ----------------------------------------------------------------

function showTab(name) {
  const isOutput = name === "output";
  $("tab-output").setAttribute("aria-selected", String(isOutput));
  $("tab-js").setAttribute("aria-selected", String(!isOutput));
  output.hidden = !isOutput;
  javascript.hidden = isOutput;
}

$("tab-output").addEventListener("click", () => showTab("output"));
$("tab-js").addEventListener("click", () => {
  showJavaScript();
  showTab("javascript");
});

// --- examples and sharing ------------------------------------------------

function setSource(text) {
  source.value = text;
  source.scrollTop = 0;
  errorLine = null;
  renderEditor();
  showJavaScript();
}

$("examples").addEventListener("change", async (event) => {
  const name = event.target.value;
  if (!name) return;
  try {
    const response = await fetch(new URL(`../examples/${name}.khanina`, import.meta.url));
    if (!response.ok) throw new Error(response.statusText);
    setSource(await response.text());
    history.replaceState(null, "", location.pathname + location.search);
    run();
  } catch {
    status.textContent = `Could not load ${name}.khanina`;
  }
  event.target.value = "";
});

const toBase64Url = (text) => {
  let binary = "";
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromBase64Url = (encoded) => {
  const binary = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(binary, (ch) => ch.charCodeAt(0)));
};

$("share").addEventListener("click", async () => {
  const url = `${location.origin}${location.pathname}${location.search}#code=${toBase64Url(source.value)}`;
  history.replaceState(null, "", url);
  try {
    await navigator.clipboard.writeText(url);
    status.textContent = "Link copied";
  } catch {
    status.textContent = "Link is in the address bar";
  }
});

function initialSource() {
  if (location.hash.startsWith("#code=")) {
    try {
      return fromBase64Url(location.hash.slice("#code=".length));
    } catch {
      status.textContent = "The shared link is broken, showing the default program";
    }
  }
  return DEFAULT_PROGRAM;
}

setSource(initialSource());
run();
