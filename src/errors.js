// Errors raised while compiling or running a .khanina program.
// Messages follow the format in SPEC.md section 6:
//   paiseh, baris 3 kolom 5: kurung kurawal belum ditutup

export function formatMessage(message, line, column) {
  if (line == null) {
    return `paiseh, ${message}`;
  }
  return `paiseh, baris ${line} kolom ${column}: ${message}`;
}

export class KhaninaError extends Error {
  constructor(message, line = null, column = null) {
    super(formatMessage(message, line, column));
    this.name = "KhaninaError";
    this.detail = message;
    this.line = line;
    this.column = column;
  }
}
