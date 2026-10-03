import { test } from "node:test";
import assert from "node:assert/strict";
import { KhaninaError, formatMessage } from "../src/errors.js";

test("error message shows line and column", () => {
  const error = new KhaninaError("kurung kurawal belum ditutup", 3, 5);
  assert.equal(error.message, "paiseh, baris 3 kolom 5: kurung kurawal belum ditutup");
  assert.equal(error.line, 3);
  assert.equal(error.column, 5);
});

test("error message without a position only has the paiseh prefix", () => {
  assert.equal(formatMessage("file tidak ditemukan"), "paiseh, file tidak ditemukan");
});
