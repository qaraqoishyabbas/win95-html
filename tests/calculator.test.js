const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Calculator } = require("../src/calculator.js");
function calculate(...tokens) {
  const c = new Calculator();
  for (const t of tokens) c.press(t);
  return c;
}
test("arithmetic chaining and repeated equals", () => {
  assert.equal(calculate("2", "+", "3", "=", "=").display, "8");
  assert.equal(calculate("1", "2", "*", "3", "-", "6", "=").display, "30");
});
test("decimal input, rounding and sign", () => {
  assert.equal(
    calculate("0", ".", "1", "+", "0", ".", "2", "=").display,
    "0.3",
  );
  assert.equal(calculate("5", "sign").display, "-5");
  assert.equal(calculate(".", ".", "5").display, "0.5");
});
test("percentage is relative for addition and scalar for multiplication", () => {
  assert.equal(
    calculate("2", "0", "0", "+", "1", "0", "%", "=").display,
    "220",
  );
  assert.equal(calculate("2", "0", "0", "*", "1", "0", "%", "=").display, "20");
});
test("errors recover with digits and clear; unary operations", () => {
  assert.equal(calculate("1", "/", "0", "=").display, "Error");
  assert.equal(calculate("1", "/", "0", "=", "7", "+", "2", "=").display, "9");
  assert.equal(calculate("9", "sqrt").display, "3");
  assert.equal(calculate("4", "reciprocal").display, "0.25");
  assert.equal(calculate("9", "sign", "sqrt").display, "Error");
});
test("memory, entry clear and backspace", () => {
  const c = calculate("5", "ms", "C", "2", "m-plus", "mr");
  assert.equal(c.display, "7");
  assert.equal(c.memory, 7);
  c.press("mc");
  assert.equal(c.memory, 0);
  assert.equal(calculate("1", "2", "Backspace").display, "1");
  assert.equal(calculate("9", "+", "3", "CE", "2", "=").display, "11");
});
test("pasting a valid decimal resets pending operation, invalid text is rejected", () => {
  const c = calculate("2", "+");
  c.paste("-1,5");
  assert.equal(c.display, "-1.5");
  c.press("+");
  c.press("2");
  c.press("=");
  assert.equal(c.display, "0.5");
  assert.throws(() => c.paste("1+2"));
});
