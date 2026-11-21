const { test, expect } = require("@playwright/test");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

test.beforeAll(() => {
  const result = spawnSync("npm", ["run", "build"], {
    cwd: path.resolve(__dirname, "../.."),
    encoding: "utf8",
  });
  expect(result.status, result.stdout + result.stderr).toBe(0);
});

test("published folder serves CSS and opens the styled desktop independently", async ({ page }) => {
  page.on("pageerror", (error) => { throw error; });
  const stylesheet = page.waitForResponse(response => response.url().endsWith("/site/dist/output.css"));
  await page.goto("/site/");
  const response = await stylesheet;
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/css");
  await expect(page.locator(".taskbar")).toHaveCSS("display", "flex");
  await expect(page.locator(".taskbar")).toHaveCSS("height", "42px");
  await expect(page.locator("#desktop")).toHaveCSS("background-color", "rgb(0, 128, 128)");
  await page.locator("#desktop-grid").getByRole("button", { name: "Калькулятор", exact: true }).dblclick();
  await expect(page.locator(".window-calculator .titlebar")).toHaveCSS("background-color", "rgb(0, 0, 128)");
  await expect(page.locator(".window-calculator .title-icon")).toHaveJSProperty("naturalWidth", 32);
});
