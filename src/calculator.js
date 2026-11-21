(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Win95Calculator = api;
})(globalThis, () => {
  class Calculator {
    constructor() {
      this.memory = 0;
      this.clear();
    }
    clear() {
      this.display = "0";
      this.stored = null;
      this.operator = null;
      this.waiting = false;
      this.repeat = null;
    }
    format(value) {
      return Number.isFinite(value)
        ? String(Number.parseFloat(value.toPrecision(12)))
        : "Error";
    }
    result(value) {
      this.display = this.format(value);
      if (this.display === "Error") {
        this.stored = null;
        this.operator = null;
        this.repeat = null;
      }
    }
    binary(a, b, op) {
      return op === "+"
        ? a + b
        : op === "-"
          ? a - b
          : op === "*"
            ? a * b
            : b === 0
              ? NaN
              : a / b;
    }
    paste(text) {
      const value = String(text).trim().replace(",", ".");
      if (
        !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value) ||
        !Number.isFinite(Number(value))
      )
        throw Error("Вставьте одно число.");
      this.clear();
      this.result(Number(value));
      this.waiting = true;
    }
    press(token) {
      if (token === "C" || token === "Escape") {
        this.clear();
        return this.display;
      }
      if (/^\d$/.test(token)) {
        if (this.display === "Error") this.clear();
        if (this.waiting) {
          this.display = token;
          this.waiting = false;
        } else if (this.display === "0") this.display = token;
        else if (this.display.length < 16) this.display += token;
        return this.display;
      }
      if (token === "mc") {
        this.memory = 0;
        return this.display;
      }
      if (token === "mr") {
        this.result(this.memory);
        this.waiting = true;
        return this.display;
      }
      if (this.display === "Error") return this.display;
      const value = Number(this.display);
      if (token === "ms") this.memory = value;
      else if (token === "m-plus") {
        const next = this.memory + value;
        if (Number.isFinite(next)) this.memory = next;
      } else if (token === "CE") {
        this.display = "0";
        this.waiting = false;
      } else if (token === "Backspace") {
        if (!this.waiting) {
          this.display = this.display.slice(0, -1);
          if (!this.display || this.display === "-") this.display = "0";
        }
      } else if (token === "." || token === ",") {
        if (this.waiting) {
          this.display = "0";
          this.waiting = false;
        }
        if (!this.display.includes(".")) this.display += ".";
      } else if (token === "sign") {
        if (value !== 0)
          this.display = this.display.startsWith("-")
            ? this.display.slice(1)
            : "-" + this.display;
      } else if (token === "sqrt" || token === "reciprocal") {
        this.result(
          token === "sqrt" ? Math.sqrt(value) : value === 0 ? NaN : 1 / value,
        );
        this.waiting = true;
      } else if (token === "%") {
        this.result(
          (this.operator === "+" || this.operator === "-") &&
            this.stored !== null
            ? (this.stored * value) / 100
            : value / 100,
        );
        this.waiting = false;
      } else if (["+", "-", "*", "/"].includes(token)) {
        if (this.operator && !this.waiting)
          this.result(this.binary(this.stored, value, this.operator));
        if (this.display === "Error") return this.display;
        this.stored = Number(this.display);
        this.operator = token;
        this.waiting = true;
        this.repeat = null;
      } else if (token === "=" || token === "Enter") {
        if (this.operator) {
          this.repeat = { operator: this.operator, value };
          this.result(this.binary(this.stored, value, this.operator));
          this.operator = null;
          this.stored = null;
        } else if (this.repeat)
          this.result(
            this.binary(value, this.repeat.value, this.repeat.operator),
          );
        this.waiting = true;
      }
      return this.display;
    }
  }
  return { Calculator };
});
