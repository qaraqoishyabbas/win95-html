const { test, expect } = require("@playwright/test");
const desktopFile = (page, name) =>
  page
    .locator("#desktop-grid .desktop-icon")
    .filter({ has: page.getByText(name, { exact: true }) });
const win = (page, title) =>
  page
    .locator(".window")
    .filter({ has: page.locator(".window-title", { hasText: title }) });
async function menu(page, scope, label, item) {
  await scope.getByRole("button", { name: label, exact: true }).click();
  await page.getByRole("menuitem", { name: item, exact: true }).click();
}
async function make(page, type, name) {
  await page
    .locator("#desktop-grid")
    .click({ button: "right", position: { x: 600, y: 420 } });
  await page
    .getByRole("menuitem", {
      name: type === "folder" ? "Новая папка" : "Новый документ",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox").fill(name);
  await dialog.getByRole("button", { name: "Создать", exact: true }).click();
}
async function openDesktop(page, name) {
  await desktopFile(page, name).dblclick();
}
test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.goto("/");
});
test("text document persists, Delete edits text, rename and download work", async ({
  page,
}) => {
  await make(page, "file", "Заметка");
  await openDesktop(page, "Заметка.txt");
  const editor = page.locator("[data-doc-editor]");
  await editor.fill("Привет мир");
  await editor.press("Home");
  await editor.press("Delete");
  await expect(editor).toHaveValue("ривет мир");
  await expect(desktopFile(page, "Заметка.txt")).toBeVisible();
  await page.reload();
  await openDesktop(page, "Заметка.txt");
  await expect(page.locator("[data-doc-editor]")).toHaveValue("ривет мир");
  const download = page.waitForEvent("download");
  await menu(page, win(page, "Заметка.txt"), "Файл", "Скачать .txt");
  expect((await download).suggestedFilename()).toBe("Заметка.txt");
  await win(page, "Заметка.txt")
    .getByRole("button", { name: "Закрыть", exact: true })
    .click();
  await desktopFile(page, "Заметка.txt").click();
  await page.keyboard.press("F2");
  await page.getByRole("dialog").getByRole("textbox").fill("Переименован");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(desktopFile(page, "Переименован.txt")).toBeVisible();
});
test("folder navigation, cut/paste, recursive copy and properties", async ({
  page,
}) => {
  await make(page, "folder", "Проекты");
  await make(page, "file", "План");
  await desktopFile(page, "План.txt").click();
  await page.keyboard.press("Control+x");
  await openDesktop(page, "Проекты");
  const explorer = win(page, "Проекты");
  await explorer.click();
  await page.keyboard.press("Control+v");
  await expect(explorer.getByText("План.txt", { exact: true })).toBeVisible();
  await expect(desktopFile(page, "План.txt")).toHaveCount(0);
  await menu(page, explorer, "Файл", "Свойства папки");
  await expect(page.getByRole("dialog")).toContainText("Проекты");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "OK", exact: true })
    .click();
  await explorer.getByRole("button", { name: "Закрыть", exact: true }).click();
  await desktopFile(page, "Проекты").click();
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  await expect(desktopFile(page, "Проекты (2)")).toBeVisible();
  await openDesktop(page, "Проекты (2)");
  await expect(
    win(page, "Проекты (2)").getByText("План.txt", { exact: true }),
  ).toBeVisible();
});
test("trash restores content and permanent deletion asks for confirmation", async ({
  page,
}) => {
  await make(page, "file", "Вернуть");
  await desktopFile(page, "Вернуть.txt").click();
  await page.keyboard.press("Delete");
  await openDesktop(page, "Корзина");
  const bin = win(page, "Корзина");
  await bin
    .getByText("Вернуть.txt", { exact: true })
    .click({ button: "right" });
  await page
    .getByRole("menuitem", { name: "Восстановить", exact: true })
    .click();
  await expect(desktopFile(page, "Вернуть.txt")).toBeVisible();
  await desktopFile(page, "Вернуть.txt").click();
  await page.keyboard.press("Delete");
  await bin
    .getByRole("button", { name: "Очистить корзину", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("безвозвратно");
  await page.getByRole("button", { name: "Удалить", exact: true }).click();
  await expect(bin.getByText("Корзина пуста", { exact: true })).toBeVisible();
});
test("calculator keyboard, maximize/restore and taskbar switching", async ({
  page,
}) => {
  await openDesktop(page, "Калькулятор");
  await page.keyboard.type("200*10%");
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-calc-display]")).toHaveText("20");
  await page.screenshot({ path: "/tmp/win95-calculator.png" });
  const calc = win(page, "Калькулятор");
  await calc.getByRole("button", { name: "Развернуть", exact: true }).click();
  await expect(calc).toHaveClass(/is-maximized/);
  await calc.getByRole("button", { name: "Восстановить", exact: true }).click();
  await expect(calc).not.toHaveClass(/is-maximized/);
  await calc.getByRole("button", { name: "Свернуть", exact: true }).click();
  await expect(calc).toBeHidden();
  await page
    .locator("#task-buttons")
    .getByRole("button", { name: "Калькулятор", exact: true })
    .click();
  await expect(calc).toBeVisible();
});
test("start programs, settings persist, help and shutdown can return", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Пуск", exact: true }).click();
  await page
    .locator("#start-menu")
    .getByRole("button", { name: "Программы", exact: true })
    .click();
  await page
    .locator("#start-menu")
    .getByRole("button", { name: "Блокнот", exact: true })
    .click();
  await expect(page.locator("[data-doc-editor]")).toBeVisible();
  await page.getByRole("button", { name: "Пуск", exact: true }).click();
  await page
    .locator("#start-menu")
    .getByRole("button", { name: "Настройки", exact: true })
    .click();
  await page.getByLabel("Цвет рабочего стола").fill("#123456");
  await page.getByRole("button", { name: "Применить", exact: true }).click();
  await page.reload();
  await expect(page.locator("#desktop")).toHaveCSS(
    "background-color",
    "rgb(18, 52, 86)",
  );
  await page.keyboard.press("F1");
  await expect(win(page, "Справка Windows 95")).toBeVisible();
  await page.getByRole("button", { name: "Пуск", exact: true }).click();
  await page
    .locator("#start-menu")
    .getByRole("button", { name: "Завершение работы", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Завершить работу", exact: true })
    .click();
  await expect(page.locator("#shutdown-screen")).toBeVisible();
  await page
    .getByRole("button", { name: "Включить компьютер", exact: true })
    .click();
  await expect(page.locator("#shutdown-screen")).toBeHidden();
});
test("legacy docs and trash migrate through reload and preserve HTML as text", async ({
  page,
}) => {
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem(
      "win95_text_documents_v1",
      JSON.stringify({
        "doc-old": {
          name: "Старый.txt",
          content: "<img src=x onerror=alert(1)>Привет",
        },
      }),
    );
    localStorage.setItem(
      "win95_recycle_bin_v1",
      JSON.stringify({
        "doc-trash": {
          name: "Из корзины.txt",
          content: "старый текст",
          deletedAt: 123,
        },
      }),
    );
  });
  await page.reload();
  await openDesktop(page, "Старый.txt");
  await expect(page.locator("[data-doc-editor]")).toHaveValue(
    "<img src=x onerror=alert(1)>Привет",
  );
  await openDesktop(page, "Корзина");
  await win(page, "Корзина")
    .getByText("Из корзины.txt", { exact: true })
    .click({ button: "right" });
  await page
    .getByRole("menuitem", { name: "Восстановить", exact: true })
    .click();
  await openDesktop(page, "Из корзины.txt");
  await expect(win(page, "Из корзины.txt").locator("textarea")).toHaveValue(
    "старый текст",
  );
});
test("Notepad search, replace, word wrap and UTF-8 import", async ({
  page,
}) => {
  await make(page, "file", "Текст");
  await openDesktop(page, "Текст.txt");
  const notepad = win(page, "Текст.txt");
  await notepad.locator("textarea").fill("один два один");
  await menu(page, notepad, "Правка", "Заменить…");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Найти").fill("один");
  await dialog.getByLabel("Заменить на").fill("три");
  await dialog
    .getByRole("button", { name: "Заменить все", exact: true })
    .click();
  await expect(notepad.locator("textarea")).toHaveValue("три два три");
  await menu(page, notepad, "Вид", "Перенос строк");
  await expect(notepad.locator("textarea")).toHaveAttribute("wrap", "off");
  await menu(page, notepad, "Файл", "Импортировать .txt…");
  await page.locator("input[type=file]").setInputFiles({
    name: "Импорт.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Содержимое UTF-8"),
  });
  await expect(win(page, "Импорт.txt").locator("textarea")).toHaveValue(
    "Содержимое UTF-8",
  );
  await page.screenshot({ path: "/tmp/win95-notepad.png" });
});
test("mobile windows and context menus fit the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await openDesktop(page, "Калькулятор");
  await page.screenshot({ path: "/tmp/win95-mobile.png" });
  const box = await win(page, "Калькулятор").boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(360);
  await win(page, "Калькулятор")
    .getByRole("button", { name: "Закрыть", exact: true })
    .click();
  await page
    .locator("#desktop-grid")
    .click({ button: "right", position: { x: 345, y: 580 } });
  const menu = await page.getByRole("menu").boundingBox();
  expect(menu.x + menu.width).toBeLessThanOrEqual(360);
  expect(menu.y + menu.height).toBeLessThanOrEqual(598);
});
test("storage failure keeps draft open and prevents deleting its file", async ({
  page,
}) => {
  await make(page, "file", "Важный");
  await openDesktop(page, "Важный.txt");
  const editor = page.locator("[data-doc-editor]");
  await editor.fill("сохранённый текст");
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    window.originalSetItem = original;
    Storage.prototype.setItem = function (key, value) {
      if (key === "win95_filesystem_v2")
        throw new DOMException("Full", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await editor.fill("последние изменения");
  await expect(page.locator("[data-editor-status]")).toContainText(
    "Не сохранено",
  );
  await win(page, "Важный.txt")
    .getByRole("button", { name: "Закрыть", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Не удалось сохранить");
  await page.getByRole("button", { name: "Остаться", exact: true }).click();
  await expect(editor).toHaveValue("последние изменения");
  // Storage may recover for another operation; that must not let trash silently discard an unsaved draft.
  await page.evaluate(() => {
    Storage.prototype.setItem = window.originalSetItem;
  });
  await desktopFile(page, "Важный.txt").click();
  await page.keyboard.press("Delete");
  await expect(editor).toHaveValue("последние изменения");
  await expect(desktopFile(page, "Важный.txt")).toBeVisible();
});
test("undo, find, menu keyboard and resize preserve document content", async ({
  page,
}) => {
  await make(page, "file", "Правка");
  await openDesktop(page, "Правка.txt");
  const notepad = win(page, "Правка.txt"),
    editor = notepad.locator("textarea");
  await editor.fill("первый");
  await editor.fill("второй первый");
  await editor.press("Control+z");
  await expect(editor).toHaveValue("первый");
  await editor.press("Control+Shift+z");
  await expect(editor).toHaveValue("второй первый");
  await editor.press("Control+f");
  await page.getByRole("dialog").getByLabel("Найти").fill("первый");
  await page.getByRole("button", { name: "Найти далее", exact: true }).click();
  await expect
    .poll(() =>
      editor.evaluate((el) =>
        el.value.slice(el.selectionStart, el.selectionEnd),
      ),
    )
    .toBe("первый");
  const before = await notepad.boundingBox(),
    handle = await notepad
      .getByRole("separator", { name: "Изменить размер окна" })
      .boundingBox();
  await page.mouse.move(handle.x + 8, handle.y + 8);
  await page.mouse.down();
  await page.mouse.move(handle.x + 108, handle.y + 68);
  await page.mouse.up();
  const after = await notepad.boundingBox();
  expect(after.width).toBeGreaterThan(before.width + 80);
  expect(after.height).toBeGreaterThan(before.height + 40);
  await notepad.getByRole("button", { name: "Файл", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("End");
  await expect(
    page.getByRole("menuitem", { name: "Закрыть", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    notepad.getByRole("button", { name: "Файл", exact: true }),
  ).toBeFocused();
});
test("corrupt storage offers backup and does not rewrite the original", async ({
  page,
}) => {
  await page.evaluate(() =>
    localStorage.setItem("win95_filesystem_v2", "{invalid"),
  );
  await page.reload();
  await expect(
    page.getByText("Не удалось открыть рабочий стол", { exact: true }),
  ).toBeVisible();
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Скачать резервную копию" }).click();
  expect((await dl).suggestedFilename()).toBe("win95-backup.json");
  expect(
    await page.evaluate(() => localStorage.getItem("win95_filesystem_v2")),
  ).toBe("{invalid");
});

test("calculator Enter activates menus, commands and window controls", async ({
  page,
}) => {
  await openDesktop(page, "Калькулятор");
  const calc = win(page, "Калькулятор");
  await calc.getByRole("button", { name: "Справка", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("menuitem", { name: "О калькуляторе", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toContainText("Вводите числа");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "OK", exact: true })
    .click();
  await calc.getByRole("button", { name: "Закрыть", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(calc).toHaveCount(0);
});
