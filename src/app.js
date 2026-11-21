(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const desktop = $("#desktop"),
    grid = $("#desktop-grid"),
    layer = $("#windows-layer");
  const start = $("#start-menu"),
    startButton = $("#start-button"),
    tasks = $("#task-buttons");
  const commandMenu = $("#command-menu"),
    dialog = $("#app-dialog");
  const escape = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const iconPaths = {
    computer: 16,
    bin: 32,
    full: 33,
    calculator: 47,
    file: 60,
    folder: 4,
    notepad: 60,
    settings: 61,
    help: 14,
    programs: 37,
    shutdown: 8,
  };
  const icon = (type) => `./icons/w95_${iconPaths[type] || 4}.ico`;
  const image = (type, className = "") =>
    `<img src="${icon(type)}" class="${className}" alt="" draggable="false">`;
  const apps = {
    computer: "Мой компьютер",
    bin: "Корзина",
    calculator: "Калькулятор",
    notepad: "Блокнот",
    settings: "Настройки",
    help: "Справка Windows 95",
  };
  const SETTINGS = "win95_settings_v1",
    POSITIONS = "win95_desktop_icons_v1";
  const state = {
    windows: new Map(),
    active: null,
    owner: "desktop",
    selected: null,
    clipboard: null,
    z: 1000,
    positions: {},
    menuItems: [],
    lastMenuFocus: null,
    settings: { color: "#008080", font: "Tiny5", clock24: true },
    recent: [],
  };
  let fs,
    noticeTimer,
    importParent = "desktop";
  const safeRead = (key, fallback) => {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : fallback;
    } catch (_) {
      return fallback;
    }
  };
  function notify(message) {
    const el = $("#notice");
    el.textContent = message;
    el.classList.remove("hidden");
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => el.classList.add("hidden"), 6500);
  }
  function attempt(action) {
    try {
      return action();
    } catch (error) {
      notify(error.message);
      return null;
    }
  }
  function download(name, text, type = "text/plain;charset=utf-8") {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function recovery(error) {
    grid.innerHTML = `<section class="recovery"><h1>Не удалось открыть рабочий стол</h1><p>${escape(error.message)}</p><p>Данные в браузере не изменены. Сохраните копию для восстановления.</p><button class="win95-btn" data-backup>Скачать резервную копию</button><button class="win95-btn" data-retry>Повторить</button></section>`;
    $("[data-backup]", grid).onclick = () =>
      attempt(() => {
        const backup = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key.startsWith("win95_")) backup[key] = localStorage.getItem(key);
        }
        download(
          "win95-backup.json",
          JSON.stringify(backup, null, 2),
          "application/json",
        );
      });
    $("[data-retry]", grid).onclick = () => location.reload();
  }
  try {
    fs = new Win95FS.FileSystem(localStorage);
  } catch (error) {
    recovery(error);
    return;
  }
  state.positions = safeRead(POSITIONS, {});
  const saved = safeRead(SETTINGS, {});
  if (/^#[0-9a-f]{6}$/i.test(saved.color)) state.settings.color = saved.color;
  if (["Tiny5", "Tahoma", "monospace"].includes(saved.font))
    state.settings.font = saved.font;
  if (typeof saved.clock24 === "boolean")
    state.settings.clock24 = saved.clock24;
  function applySettings() {
    desktop.style.backgroundColor = state.settings.color;
    document.body.style.fontFamily = `${state.settings.font}, monospace`;
    updateClock();
  }
  function updateClock() {
    const now = new Date();
    $("#clock").textContent = now.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: !state.settings.clock24,
    });
    $("#clock").title = now.toLocaleDateString("ru-RU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  function size(bytes) {
    return bytes < 1024
      ? `${bytes} Б`
      : bytes < 1048576
        ? `${(bytes / 1024).toFixed(1)} КБ`
        : `${(bytes / 1048576).toFixed(1)} МБ`;
  }
  function nodeIcon(node) {
    return node.type === "folder" ? "folder" : "file";
  }
  function title(w) {
    return w.kind === "notepad"
      ? `${fs.get(w.fileId)?.name || "Документ"} - Блокнот`
      : w.kind === "explorer"
        ? w.folderId === "root"
          ? "Мой компьютер — Диск C:"
          : fs.get(w.folderId)?.name || "Проводник"
        : apps[w.kind];
  }
  function typeOf(id) {
    return id === "app:bin"
      ? fs.trashItems().length
        ? "full"
        : "bin"
      : id.startsWith("app:")
        ? id.slice(4)
        : nodeIcon(fs.get(id) || {});
  }
  function desktopEntries() {
    return [
      { id: "app:computer", name: apps.computer },
      { id: "app:bin", name: apps.bin },
      { id: "app:calculator", name: apps.calculator },
      ...fs.list("desktop"),
    ];
  }
  function buttonFor(node, desktopIcon = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.id = node.id;
    button.className = desktopIcon ? "desktop-icon" : "explorer-item";
    const selected = desktopIcon
      ? state.owner === "desktop" && state.selected === node.id
      : false;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-label", node.name);
    button.innerHTML = `<span class="icon-box">${image(typeOf(node.id), desktopIcon ? "" : "explorer-item-icon")}</span><span class="${desktopIcon ? "icon-label" : "explorer-item-label"}">${escape(node.name)}</span>`;
    if (state.clipboard?.cut && state.clipboard.id === node.id)
      button.classList.add("is-cut");
    button.onclick = (e) => {
      e.stopPropagation();
      select(
        node.id,
        desktopIcon ? "desktop" : button.closest(".window").dataset.key,
      );
    };
    button.ondblclick = () => openItem(node.id);
    button.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        openItem(node.id);
      }
    };
    return button;
  }
  function persistPositions() {
    attempt(() =>
      localStorage.setItem(POSITIONS, JSON.stringify(state.positions)),
    );
  }
  function slot(index) {
    const rows = Math.max(1, Math.floor((desktop.clientHeight - 20) / 94));
    return {
      left: 12 + Math.floor(index / rows) * 104,
      top: 12 + (index % rows) * 94,
    };
  }
  function positionIcon(button, index) {
    const raw = state.positions[button.dataset.id] || slot(index);
    const left = Math.min(
      Math.max(0, desktop.clientWidth - button.offsetWidth),
      Math.max(0, parseFloat(raw.left) || 0),
    );
    const top = Math.min(
      Math.max(0, desktop.clientHeight - button.offsetHeight),
      Math.max(0, parseFloat(raw.top) || 0),
    );
    button.style.left = `${left}px`;
    button.style.top = `${top}px`;
  }
  function renderDesktop() {
    grid.replaceChildren();
    const entries = desktopEntries();
    // Reserve saved positions before placing new items, including items later in sort order.
    for (const node of entries) {
      const old = {
        "app:computer": "my-computer",
        "app:bin": "recycle-bin",
        "app:calculator": "calculator",
      }[node.id];
      if (!state.positions[node.id] && old && state.positions[old])
        state.positions[node.id] = state.positions[old];
    }
    const occupied = entries
      .filter((n) => state.positions[n.id])
      .map((n) => ({
        left: parseFloat(state.positions[n.id].left) || 0,
        top: parseFloat(state.positions[n.id].top) || 0,
      }));
    entries.forEach((node, index) => {
      const button = buttonFor(node, true);
      grid.append(button);
      // Old document IDs keep their saved positions; system keys changed only in memory.
      const old = node.id.startsWith("app:")
        ? {
            "app:computer": "my-computer",
            "app:bin": "recycle-bin",
            "app:calculator": "calculator",
          }[node.id]
        : node.id;
      if (!state.positions[node.id] && state.positions[old])
        state.positions[node.id] = state.positions[old];
      if (!state.positions[node.id]) {
        let n = index,
          p = slot(n);
        while (
          occupied.some(
            (q) =>
              Math.abs(q.left - p.left) < 82 && Math.abs(q.top - p.top) < 82,
          ) &&
          n < entries.length + 100
        )
          p = slot(++n);
        state.positions[node.id] = p;
      }
      positionIcon(button, index);
      occupied.push({
        left: parseFloat(button.style.left),
        top: parseFloat(button.style.top),
      });
      makeIconDraggable(button);
    });
  }
  function select(id, owner) {
    state.selected = id;
    state.owner = owner;
    if (owner === "desktop") {
      state.active = null;
      for (const w of state.windows.values())
        w.el.classList.remove("is-active");
      renderTasks();
    } else {
      const w = state.windows.get(owner);
      if (w) {
        w.selected = id;
        focusWindow(w, false);
      }
    }
    updateSelections();
  }
  function updateSelections() {
    grid.querySelectorAll("[data-id]").forEach((el) => {
      const selected =
        state.owner === "desktop" && state.selected === el.dataset.id;
      el.classList.toggle("active", selected);
      el.setAttribute("aria-pressed", String(selected));
    });
    for (const w of state.windows.values())
      if (w.kind === "explorer" || w.kind === "bin")
        w.el.querySelectorAll("[data-id]").forEach((el) => {
          el.classList.toggle("is-selected", w.selected === el.dataset.id);
          el.setAttribute("aria-pressed", String(w.selected === el.dataset.id));
        });
  }
  function hideMenus(restoreFocus = false) {
    commandMenu.classList.add("hidden");
    state.menuItems = [];
    if (restoreFocus) state.lastMenuFocus?.focus();
  }
  function hideStart() {
    start.classList.add("hidden");
    startButton.classList.remove("active");
    startButton.setAttribute("aria-expanded", "false");
  }
  function showMenu(items, x, y, anchor = null) {
    hideMenus();
    hideStart();
    state.menuItems = items;
    state.lastMenuFocus = anchor || document.activeElement;
    commandMenu.replaceChildren();
    items.forEach((item) => {
      if (!item) {
        const hr = document.createElement("div");
        hr.className = "context-menu-separator";
        hr.setAttribute("role", "separator");
        commandMenu.append(hr);
        return;
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = "context-menu-item";
      button.role = "menuitem";
      button.textContent = item.label;
      button.disabled = !!item.disabled;
      button.onclick = () => {
        hideMenus();
        state.lastMenuFocus?.focus();
        Promise.resolve(item.action()).catch((error) => notify(error.message));
      };
      commandMenu.append(button);
    });
    commandMenu.style.zIndex = String(++state.z + 100);
    commandMenu.classList.remove("hidden");
    commandMenu.style.left = `${Math.max(0, Math.min(x, innerWidth - commandMenu.offsetWidth - 4))}px`;
    commandMenu.style.top = `${Math.max(0, Math.min(y, desktop.getBoundingClientRect().bottom - commandMenu.offsetHeight - 4))}px`;
    commandMenu.querySelector("button:not(:disabled)")?.focus();
  }
  function popup(titleText, content, buttons = [{ label: "OK", value: "ok" }]) {
    hideMenus();
    hideStart();
    if (dialog.open) return Promise.resolve(null);
    const previous = document.activeElement;
    dialog.innerHTML = `<form method="dialog"><div class="dialog-title" id="dialog-title">${escape(titleText)}</div><div class="dialog-content">${content}</div><div class="dialog-actions">${buttons.map((b, i) => `<button class="win95-btn" type="submit" value="${escape(b.value)}" ${i === 0 ? "data-primary" : "formnovalidate"}>${escape(b.label)}</button>`).join("")}</div></form>`;
    dialog.returnValue = "";
    dialog.showModal();
    const input = $("input:not([type=checkbox]),textarea,select", dialog);
    if (input) {
      input.focus();
      input.select?.();
    }
    return new Promise((resolve) => {
      dialog.onclose = () => {
        const fields = {};
        new FormData($("form", dialog)).forEach(
          (value, key) => (fields[key] = value),
        );
        const result = dialog.returnValue
          ? { action: dialog.returnValue, ...fields }
          : null;
        dialog.onclose = null;
        previous?.focus();
        resolve(result);
      };
    });
  }
  async function askName(id = null, type = "file", parent = currentParent()) {
    const old = id ? fs.get(id) : null;
    const result = await popup(
      old
        ? "Переименовать"
        : type === "folder"
          ? "Новая папка"
          : "Новый документ",
      `<label class="field">Имя<input name="name" aria-label="Имя" maxlength="255" value="${escape(old?.name || (type === "folder" ? "Новая папка" : "Новый документ.txt"))}" required></label>`,
      [
        { label: old ? "Сохранить" : "Создать", value: "save" },
        { label: "Отмена", value: "cancel" },
      ],
    );
    if (result?.action !== "save") return;
    const node = attempt(() =>
      old ? fs.rename(id, result.name) : fs.create(parent, type, result.name),
    );
    if (node) {
      refresh();
      const w = findFolder(parent);
      select(node.id, parent === "desktop" ? "desktop" : w?.key || "desktop");
    }
    return node;
  }
  function currentWindow() {
    return state.windows.get(state.active);
  }
  function currentParent(w = currentWindow()) {
    return w?.kind === "explorer"
      ? w.folderId
      : w?.kind === "notepad"
        ? fs.get(w.fileId)?.parent || "desktop"
        : "desktop";
  }
  function currentSelection(w = null) {
    return w
      ? w.selected
      : state.owner === "desktop"
        ? state.selected
        : currentWindow()?.selected;
  }
  function findFolder(id) {
    return [...state.windows.values()].find(
      (w) => w.kind === "explorer" && w.folderId === id,
    );
  }
  function copyFile(id, cut = false) {
    const n = fs.get(id);
    if (!n || n.protected || !fs.isAvailable(id)) return;
    state.clipboard = { id, cut };
    renderDesktop();
    refreshViews();
    notify(`${n.name}: ${cut ? "вырезано" : "скопировано"}`);
  }
  function pasteFile(parent) {
    if (!state.clipboard) return;
    const { id, cut } = state.clipboard;
    const node = attempt(() => fs.transfer(id, parent, !cut));
    if (node) {
      if (cut) state.clipboard = null;
      refresh();
      const w = findFolder(parent);
      select(node.id, parent === "desktop" ? "desktop" : w?.key || "desktop");
    }
  }
  function trashFile(id) {
    if (!id || id.startsWith("app:")) return;
    const affected = new Set([id, ...fs.descendants(id)]);
    const dirty = [...state.windows.values()].find(
      (w) => w.unsaved && affected.has(w.fileId),
    );
    if (dirty) {
      focusWindow(dirty);
      notify(
        "Сначала сохраните или скачайте несохранённые изменения документа.",
      );
      return;
    }
    if (attempt(() => fs.trash(id))) {
      state.selected = null;
      refresh();
    }
  }
  async function confirmRemoval(id = null) {
    const name = id ? fs.get(id)?.name : null;
    if (id && !name) return;
    const result = await popup(
      id ? "Удалить навсегда" : "Очистить корзину",
      `<p>${id ? `Удалить «${escape(name)}»` : "Удалить все объекты из корзины"} безвозвратно?</p>`,
      [
        { label: "Удалить", value: "delete" },
        { label: "Отмена", value: "cancel" },
      ],
    );
    if (result?.action === "delete") {
      attempt(() => (id ? fs.purge(id) : fs.emptyTrash()));
      refresh();
    }
  }
  function restoreFile(id) {
    if (attempt(() => fs.restore(id))) refresh();
  }
  async function properties(id) {
    if (id?.startsWith("app:")) {
      const kind = id.slice(4);
      await popup(
        "Свойства",
        `<p><strong>${escape(apps[kind])}</strong></p><p>Приложение рабочего стола Windows 95.</p>`,
      );
      return;
    }
    const n = fs.get(id);
    if (!n) return;
    const date = (value) => new Date(value).toLocaleString("ru-RU");
    await popup(
      "Свойства",
      `<dl class="properties"><dt>Имя</dt><dd>${escape(n.name)}</dd><dt>Тип</dt><dd>${n.type === "folder" ? "Папка" : "Текстовый документ (.txt)"}</dd><dt>Расположение</dt><dd>${escape(fs.path(n.parent))}</dd><dt>Размер</dt><dd>${size(fs.size(id))}</dd><dt>Создан</dt><dd>${date(n.createdAt)}</dd><dt>Изменён</dt><dd>${date(n.modifiedAt)}</dd>${n.deletedAt ? `<dt>Удалён</dt><dd>${date(n.deletedAt)}</dd>` : ""}</dl>`,
    );
  }
  function fileItems(id, parent, bin = false) {
    if (bin)
      return [
        { label: "Восстановить", action: () => restoreFile(id) },
        { label: "Удалить навсегда", action: () => confirmRemoval(id) },
        null,
        { label: "Свойства", action: () => properties(id) },
      ];
    const n = fs.get(id),
      special = id?.startsWith("app:");
    return [
      { label: "Открыть", action: () => openItem(id) },
      null,
      ...(!special && !n?.protected
        ? [
            { label: "Вырезать", action: () => copyFile(id, true) },
            { label: "Копировать", action: () => copyFile(id) },
            { label: "Переименовать", action: () => askName(id) },
            { label: "Удалить", action: () => trashFile(id) },
            null,
          ]
        : []),
      { label: "Свойства", action: () => properties(id) },
    ];
  }
  function folderItems(parent) {
    return [
      { label: "Новый документ", action: () => askName(null, "file", parent) },
      { label: "Новая папка", action: () => askName(null, "folder", parent) },
      { label: "Импортировать .txt…", action: () => importFiles(parent) },
      null,
      {
        label: "Вставить",
        disabled: !state.clipboard,
        action: () => pasteFile(parent),
      },
      { label: "Обновить", action: () => refresh() },
      ...(parent === "desktop"
        ? [
            { label: "Упорядочить ярлыки", action: () => arrangeIcons() },
            { label: "Свойства", action: () => openApp("settings") },
          ]
        : [{ label: "Свойства папки", action: () => properties(parent) }]),
    ];
  }
  function refresh() {
    for (const w of [...state.windows.values()]) {
      if (
        (w.kind === "notepad" && !fs.isAvailable(w.fileId)) ||
        (w.kind === "explorer" && !fs.isAvailable(w.folderId))
      )
        closeWindow(w);
    }
    if (state.clipboard && !fs.isAvailable(state.clipboard.id))
      state.clipboard = null;
    renderDesktop();
    refreshViews();
    renderTasks();
  }
  function refreshViews() {
    for (const w of state.windows.values()) {
      updateTitle(w);
      if (w.kind === "explorer" || w.kind === "bin") renderExplorer(w);
    }
    updateSelections();
  }
  function arrangeIcons() {
    desktopEntries()
      .sort((a, b) => a.name.localeCompare(b.name, "ru"))
      .forEach((n, i) => (state.positions[n.id] = slot(i)));
    persistPositions();
    renderDesktop();
  }
  function makeIconDraggable(button) {
    let drag = null;
    button.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      drag = {
        x: e.clientX,
        y: e.clientY,
        left: parseFloat(button.style.left),
        top: parseFloat(button.style.top),
        moved: false,
      };
    });
    button.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 6) return;
      drag.moved = true;
      button.setPointerCapture(e.pointerId);
      button.style.zIndex = "5";
      button.style.left = `${Math.min(Math.max(0, desktop.clientWidth - button.offsetWidth), Math.max(0, drag.left + dx))}px`;
      button.style.top = `${Math.min(Math.max(0, desktop.clientHeight - button.offsetHeight), Math.max(0, drag.top + dy))}px`;
    });
    const stop = (e) => {
      if (!drag) return;
      if (drag.moved) {
        state.positions[button.dataset.id] = {
          left: parseFloat(button.style.left),
          top: parseFloat(button.style.top),
        };
        persistPositions();
        if (button.hasPointerCapture(e.pointerId))
          button.releasePointerCapture(e.pointerId);
      }
      drag = null;
    };
    button.addEventListener("pointerup", stop);
    button.addEventListener("pointercancel", stop);
    button.addEventListener("pointerleave", () => {
      if (drag && !drag.moved) drag = null;
    });
  }
  function openItem(id) {
    hideMenus();
    hideStart();
    if (id?.startsWith("app:")) return openApp(id.slice(4));
    const n = fs.get(id);
    if (!n || !fs.isAvailable(id)) return;
    if (n.type === "folder") return openFolder(id);
    state.recent = [id, ...state.recent.filter((x) => x !== id)].slice(0, 12);
    const existing = [...state.windows.values()].find(
      (w) => w.kind === "notepad" && w.fileId === id,
    );
    if (existing) {
      focusWindow(existing);
      return existing;
    }
    const w = createWindow("notepad", {
      fileId: id,
      wrap: true,
      zoom: 13,
      find: "",
      undo: [],
      redo: [],
    });
    renderNotepad(w);
    focusWindow(w);
    return w;
  }
  function openFolder(id) {
    const existing = findFolder(id);
    if (existing) {
      focusWindow(existing);
      return existing;
    }
    const w = createWindow("explorer", {
      folderId: id,
      history: [],
      selected: null,
    });
    renderExplorer(w);
    focusWindow(w);
    return w;
  }
  function navigate(w, id, back = false) {
    if (!fs.isAvailable(id)) return;
    if (!back) w.history.push(w.folderId);
    w.folderId = id;
    w.selected = null;
    renderExplorer(w);
    updateTitle(w);
    renderTasks();
  }
  function openApp(kind) {
    hideStart();
    hideMenus();
    if (kind === "computer") return openFolder("root");
    if (kind === "notepad") {
      const node = attempt(() =>
        fs.create("documents", "file", "Новый документ.txt"),
      );
      if (node) {
        refresh();
        return openItem(node.id);
      }
      return;
    }
    const existing = [...state.windows.values()].find((w) => w.kind === kind);
    if (existing) {
      focusWindow(existing);
      return existing;
    }
    const w = createWindow(kind);
    if (kind === "calculator") renderCalculator(w);
    if (kind === "bin") renderExplorer(w);
    if (kind === "settings") renderSettings(w);
    if (kind === "help") renderHelp(w);
    focusWindow(w);
    return w;
  }
  function createWindow(kind, extra = {}) {
    const key = `window-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const el = document.createElement("section");
    el.className = `window window-${kind}`;
    el.dataset.key = key;
    el.tabIndex = -1;
    el.setAttribute("aria-label", apps[kind] || "Окно");
    const offset = (state.windows.size % 7) * 24;
    Object.assign(el.style, {
      left: `${110 + offset}px`,
      top: `${40 + offset}px`,
      width: kind === "calculator" ? "368px" : "560px",
      height: kind === "calculator" ? "420px" : "410px",
    });
    const w = { key, kind, el, selected: null, maximized: false, ...extra };
    state.windows.set(key, w);
    el.innerHTML = `<div class="titlebar">${image(kind === "explorer" ? "computer" : kind, "title-icon")}<span class="window-title"></span><div class="titlebar-controls"><button class="win95-btn ctrl-btn" aria-label="Свернуть" title="Свернуть" data-min>_</button><button class="win95-btn ctrl-btn" aria-label="Развернуть" title="Развернуть" data-max>□</button><button class="win95-btn ctrl-btn" aria-label="Закрыть" title="Закрыть" data-close>×</button></div></div><div class="window-content"></div><div class="resize-handle" role="separator" tabindex="0" aria-label="Изменить размер окна"></div>`;
    w.content = $(".window-content", el);
    layer.append(el);
    updateTitle(w);
    clampWindow(w);
    $("[data-min]", el).onclick = () => minimize(w);
    $("[data-max]", el).onclick = () => maximize(w);
    $("[data-close]", el).onclick = () => closeWindow(w);
    el.addEventListener("pointerdown", () => focusWindow(w, false));
    $(".titlebar", el).ondblclick = (e) => {
      if (!e.target.closest("button")) maximize(w);
    };
    makeWindowDraggable(w);
    makeResizable(w);
    return w;
  }
  function updateTitle(w) {
    const text = title(w);
    $(".window-title", w.el).textContent = text;
    w.el.setAttribute("aria-label", text);
  }
  function focusWindow(w, moveFocus = true) {
    if (!w) return;
    w.el.classList.remove("hidden");
    w.el.style.zIndex = String(++state.z);
    state.active = w.key;
    state.owner = w.key;
    for (const other of state.windows.values())
      other.el.classList.toggle("is-active", other === w);
    if (moveFocus) ($("[data-doc-editor]", w.el) || w.el).focus();
    renderTasks();
  }
  function focusNext() {
    const next = [...state.windows.values()]
      .filter((w) => !w.el.classList.contains("hidden"))
      .sort((a, b) => Number(b.el.style.zIndex) - Number(a.el.style.zIndex))[0];
    state.active = null;
    if (next) focusWindow(next);
    else {
      state.owner = "desktop";
      grid.focus();
      renderTasks();
    }
  }
  function minimize(w) {
    w.el.classList.add("hidden");
    if (state.active === w.key) focusNext();
    renderTasks();
  }
  function closeWindow(w) {
    w.el.remove();
    state.windows.delete(w.key);
    hideMenus();
    if (state.active === w.key) focusNext();
    renderTasks();
  }
  function renderTasks() {
    tasks.replaceChildren();
    for (const w of state.windows.values()) {
      const button = document.createElement("button");
      button.className = "win95-btn task-btn";
      button.classList.toggle(
        "active",
        state.active === w.key && !w.el.classList.contains("hidden"),
      );
      const name =
        w.kind === "notepad"
          ? fs.get(w.fileId)?.name
          : w.kind === "explorer"
            ? w.folderId === "root"
              ? "Мой компьютер"
              : fs.get(w.folderId)?.name
            : apps[w.kind];
      button.setAttribute("aria-label", name || "Окно");
      button.title = title(w);
      button.innerHTML = `${image(w.kind === "explorer" ? "computer" : w.kind === "bin" && fs.trashItems().length ? "full" : w.kind)}<span>${escape(name)}</span>`;
      button.onclick = () => {
        if (state.active === w.key && !w.el.classList.contains("hidden"))
          minimize(w);
        else focusWindow(w);
      };
      tasks.append(button);
    }
  }
  function clampWindow(w) {
    if (w.maximized) return;
    const width = Math.min(
        parseFloat(w.el.style.width) || 560,
        desktop.clientWidth,
      ),
      height = Math.min(
        parseFloat(w.el.style.height) || 410,
        desktop.clientHeight,
      );
    w.el.style.width = `${Math.max(0, width)}px`;
    w.el.style.height = `${Math.max(0, height)}px`;
    w.el.style.left = `${Math.min(Math.max(0, desktop.clientWidth - width), Math.max(0, parseFloat(w.el.style.left) || 0))}px`;
    w.el.style.top = `${Math.min(Math.max(0, desktop.clientHeight - height), Math.max(0, parseFloat(w.el.style.top) || 0))}px`;
  }
  function maximize(w) {
    if (w.maximized) {
      Object.assign(w.el.style, w.restoreRect);
      w.maximized = false;
      w.el.classList.remove("is-maximized");
      clampWindow(w);
    } else {
      w.restoreRect = {
        left: w.el.style.left,
        top: w.el.style.top,
        width: w.el.style.width,
        height: w.el.style.height,
      };
      w.maximized = true;
      w.el.classList.add("is-maximized");
      Object.assign(w.el.style, {
        left: "0px",
        top: "0px",
        width: "100%",
        height: "100%",
      });
    }
    const button = $("[data-max]", w.el);
    button.setAttribute(
      "aria-label",
      w.maximized ? "Восстановить" : "Развернуть",
    );
    button.title = w.maximized ? "Восстановить" : "Развернуть";
    focusWindow(w, false);
  }
  function makeWindowDraggable(w) {
    const bar = $(".titlebar", w.el);
    let drag = null;
    bar.onpointerdown = (e) => {
      if (e.button !== 0 || e.target.closest("button") || w.maximized) return;
      drag = {
        x: e.clientX,
        y: e.clientY,
        left: parseFloat(w.el.style.left),
        top: parseFloat(w.el.style.top),
      };
      bar.setPointerCapture(e.pointerId);
    };
    bar.onpointermove = (e) => {
      if (!drag) return;
      w.el.style.left = `${drag.left + e.clientX - drag.x}px`;
      w.el.style.top = `${drag.top + e.clientY - drag.y}px`;
      clampWindow(w);
    };
    bar.onpointerup = bar.onpointercancel = (e) => {
      drag = null;
      if (bar.hasPointerCapture(e.pointerId))
        bar.releasePointerCapture(e.pointerId);
    };
  }
  function makeResizable(w) {
    const handle = $(".resize-handle", w.el);
    let drag = null;
    const resize = (width, height) => {
      if (w.maximized) return;
      w.el.style.width = `${Math.max(Math.min(280, desktop.clientWidth), width)}px`;
      w.el.style.height = `${Math.max(Math.min(240, desktop.clientHeight), height)}px`;
      clampWindow(w);
    };
    handle.onpointerdown = (e) => {
      if (e.button !== 0 || w.maximized) return;
      drag = {
        x: e.clientX,
        y: e.clientY,
        width: w.el.offsetWidth,
        height: w.el.offsetHeight,
      };
      handle.setPointerCapture(e.pointerId);
      e.preventDefault();
    };
    handle.onpointermove = (e) => {
      if (drag)
        resize(
          drag.width + e.clientX - drag.x,
          drag.height + e.clientY - drag.y,
        );
    };
    handle.onpointerup = handle.onpointercancel = (e) => {
      drag = null;
      if (handle.hasPointerCapture(e.pointerId))
        handle.releasePointerCapture(e.pointerId);
    };
    handle.onkeydown = (e) => {
      if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        resize(
          w.el.offsetWidth +
            (e.key === "ArrowRight" ? 20 : e.key === "ArrowLeft" ? -20 : 0),
          w.el.offsetHeight +
            (e.key === "ArrowDown" ? 20 : e.key === "ArrowUp" ? -20 : 0),
        );
      }
    };
  }
  function menubar(w, menus) {
    const bar = document.createElement("div");
    bar.className = "explorer-menubar";
    for (const [label, items] of menus) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "app-menu-button";
      button.textContent = label;
      button.setAttribute("aria-haspopup", "menu");
      button.onclick = () => {
        focusWindow(w, false);
        const rect = button.getBoundingClientRect();
        showMenu(items(), rect.left, rect.bottom, button);
      };
      bar.append(button);
    }
    return bar;
  }
  function renderExplorer(w) {
    const bin = w.kind === "bin",
      parent = bin ? null : w.folderId;
    const nodes = bin ? fs.trashItems() : fs.list(parent);
    if (!nodes.some((n) => n.id === w.selected)) w.selected = null;
    const scroll = $(".explorer-workspace", w.content)?.scrollTop || 0;
    w.content.replaceChildren();
    w.content.className = "window-content explorer-shell";
    const fileMenu = () =>
      bin
        ? [
            {
              label: "Восстановить",
              disabled: !w.selected,
              action: () => restoreFile(w.selected),
            },
            {
              label: "Удалить навсегда",
              disabled: !w.selected,
              action: () => confirmRemoval(w.selected),
            },
            {
              label: "Очистить корзину",
              disabled: !nodes.length,
              action: () => confirmRemoval(),
            },
            null,
            {
              label: "Свойства",
              disabled: !w.selected,
              action: () => properties(w.selected),
            },
          ]
        : [
            ...folderItems(w.folderId),
            null,
            ...(w.selected ? fileItems(w.selected, w.folderId) : []),
          ];
    w.content.append(
      menubar(w, [
        ["Файл", fileMenu],
        [
          "Правка",
          () =>
            bin
              ? [
                  {
                    label: "Восстановить все",
                    disabled: !nodes.length,
                    action: () => restoreAll(),
                  },
                ]
              : [
                  {
                    label: "Вырезать",
                    disabled: !w.selected || fs.get(w.selected)?.protected,
                    action: () => copyFile(w.selected, true),
                  },
                  {
                    label: "Копировать",
                    disabled: !w.selected || fs.get(w.selected)?.protected,
                    action: () => copyFile(w.selected),
                  },
                  {
                    label: "Вставить",
                    disabled: !state.clipboard,
                    action: () => pasteFile(w.folderId),
                  },
                ],
        ],
        [
          "Вид",
          () => [
            {
              label: "Значки",
              action: () => {
                w.details = false;
                renderExplorer(w);
              },
            },
            {
              label: "Список",
              action: () => {
                w.details = true;
                renderExplorer(w);
              },
            },
            { label: "Обновить", action: () => refresh() },
          ],
        ],
        [
          "Справка",
          () => [
            { label: "Справка Windows 95", action: () => openApp("help") },
          ],
        ],
      ]),
    );
    const toolbar = document.createElement("div");
    toolbar.className = "explorer-toolbar";
    if (bin)
      toolbar.innerHTML = `<button class="win95-btn" data-empty ${nodes.length ? "" : "disabled"}>Очистить корзину</button>`;
    else
      toolbar.innerHTML = `<button class="win95-btn" data-back ${w.history.length ? "" : "disabled"} aria-label="Назад">←</button><button class="win95-btn" data-up ${parent === "root" ? "disabled" : ""} aria-label="На уровень вверх">↑</button><span class="folder-path" title="${escape(fs.path(parent))}">${escape(fs.path(parent))}</span>`;
    w.content.append(toolbar);
    if (bin) $("[data-empty]", toolbar).onclick = () => confirmRemoval();
    else {
      $("[data-back]", toolbar).onclick = () => {
        let id;
        do {
          id = w.history.pop();
        } while (id && !fs.isAvailable(id));
        if (id) navigate(w, id, true);
        else renderExplorer(w);
      };
      $("[data-up]", toolbar).onclick = () =>
        navigate(w, fs.get(w.folderId).parent);
    }
    const workspace = document.createElement("div");
    workspace.className = `explorer-workspace win95-scroll${w.details ? " explorer-list" : ""}`;
    workspace.tabIndex = 0;
    workspace.setAttribute(
      "aria-label",
      bin ? "Содержимое корзины" : "Содержимое папки",
    );
    for (const n of nodes) {
      const button = buttonFor(n);
      button.onclick = (e) => {
        e.stopPropagation();
        select(n.id, w.key);
      };
      button.ondblclick = () => {
        if (bin) restoreFile(n.id);
        else if (n.type === "folder") navigate(w, n.id);
        else openItem(n.id);
      };
      button.onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          button.ondblclick();
        }
      };
      workspace.append(button);
    }
    if (!nodes.length) {
      const empty = document.createElement("p");
      empty.className = "explorer-empty";
      empty.textContent = bin
        ? "Корзина пуста"
        : "В этой папке пока нет файлов";
      workspace.append(empty);
    }
    workspace.onclick = (e) => {
      if (!e.target.closest("[data-id]")) {
        w.selected = null;
        select(null, w.key);
      }
    };
    workspace.oncontextmenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      focusWindow(w, false);
      const id = e.target.closest("[data-id]")?.dataset.id;
      if (id) {
        select(id, w.key);
        showMenu(fileItems(id, parent, bin), e.clientX, e.clientY);
      } else
        showMenu(
          bin
            ? [
                {
                  label: "Очистить корзину",
                  disabled: !nodes.length,
                  action: () => confirmRemoval(),
                },
              ]
            : folderItems(parent),
          e.clientX,
          e.clientY,
        );
    };
    w.content.append(workspace);
    workspace.scrollTop = scroll;
    const status = document.createElement("div");
    status.className = "explorer-statusbar";
    status.innerHTML = `<span class="explorer-status-cell">${nodes.length} объект(ов)</span><span class="explorer-status-cell">${size(nodes.reduce((sum, n) => sum + fs.size(n.id), 0))}</span>`;
    w.content.append(status);
    updateSelections();
  }
  function restoreAll() {
    for (const node of fs.trashItems())
      if (!attempt(() => fs.restore(node.id))) break;
    refresh();
  }
  function editorValue(w, value, record = true) {
    const editor = $("[data-doc-editor]", w.el);
    if (record && editor.value !== value) {
      w.undo.push(editor.value);
      if (w.undo.length > 100) w.undo.shift();
      w.redo = [];
    }
    editor.value = value;
    w.lastText = value;
    saveEditor(w);
  }
  function saveEditor(w) {
    const editor = $("[data-doc-editor]", w.el);
    if (!editor) return true;
    try {
      fs.write(w.fileId, editor.value);
      w.unsaved = false;
    } catch (error) {
      w.unsaved = true;
      notify(
        error.message +
          " Текст остаётся в редакторе; скачайте его через меню «Файл».",
      );
    }
    updateEditorStatus(w);
    return !w.unsaved;
  }
  function updateEditorStatus(w) {
    const editor = $("[data-doc-editor]", w.el),
      status = $("[data-editor-status]", w.el);
    if (status)
      status.textContent = `${w.unsaved ? "Не сохранено" : "Сохранено"} · ${editor.value.length} символов · ${size(new TextEncoder().encode(editor.value).length)}`;
  }
  function undoEditor(w, redo = false) {
    const from = redo ? w.redo : w.undo,
      to = redo ? w.undo : w.redo;
    if (!from.length) return;
    const editor = $("[data-doc-editor]", w.el);
    to.push(editor.value);
    editorValue(w, from.pop(), false);
    editor.focus();
  }
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      const helper = document.createElement("textarea");
      helper.value = text;
      helper.style.position = "fixed";
      helper.style.opacity = "0";
      document.body.append(helper);
      helper.select();
      let success = false;
      try {
        success = document.execCommand("copy");
      } catch (_) {}
      helper.remove();
      if (!success) {
        await popup(
          "Копировать текст",
          '<p>Выделите текст и нажмите Ctrl+C или ⌘C.</p><textarea aria-label="Текст для копирования" class="clipboard-text">' +
            escape(text) +
            "</textarea>",
        );
      }
      return success;
    }
  }
  async function readText() {
    try {
      return await navigator.clipboard.readText();
    } catch (_) {
      const result = await popup(
        "Вставить текст",
        '<p>Вставьте текст из буфера обмена в поле ниже.</p><label class="field">Текст<textarea name="text" aria-label="Текст" class="clipboard-text"></textarea></label>',
        [
          { label: "Вставить", value: "paste" },
          { label: "Отмена", value: "cancel" },
        ],
      );
      return result?.action === "paste" ? result.text : null;
    }
  }
  async function editClipboard(w, action) {
    const editor = $("[data-doc-editor]", w.el),
      from = editor.selectionStart,
      to = editor.selectionEnd;
    if (action === "paste") {
      const text = await readText();
      if (text === null) return;
      editorValue(
        w,
        editor.value.slice(0, from) + text + editor.value.slice(to),
      );
      editor.setSelectionRange(from + text.length, from + text.length);
    } else {
      const copied = await copyText(editor.value.slice(from, to));
      if (action === "cut" && copied) {
        editorValue(w, editor.value.slice(0, from) + editor.value.slice(to));
        editor.setSelectionRange(from, from);
      }
    }
    editor.focus();
  }
  function renderNotepad(w) {
    w.content.className = "window-content explorer-shell";
    const editor = document.createElement("textarea");
    editor.className = "notepad-editor win95-scroll";
    editor.dataset.docEditor = "";
    editor.setAttribute("aria-label", "Текст документа");
    editor.spellcheck = false;
    editor.wrap = "soft";
    editor.value = fs.get(w.fileId).content || "";
    w.lastText = editor.value;
    w.content.append(
      menubar(w, [
        [
          "Файл",
          () => [
            { label: "Новый документ", action: () => newEditorDocument(w) },
            {
              label: "Импортировать .txt…",
              action: () => importFiles(currentParent(w)),
            },
            {
              label: "Сохранить",
              action: () => {
                if (saveEditor(w)) notify("Документ сохранён");
              },
            },
            { label: "Сохранить копию…", action: () => saveCopy(w) },
            {
              label: "Скачать .txt",
              action: () => download(fs.get(w.fileId).name, editor.value),
            },
            null,
            { label: "Переименовать", action: () => askName(w.fileId) },
            { label: "Свойства", action: () => properties(w.fileId) },
            { label: "Закрыть", action: () => requestClose(w) },
          ],
        ],
        [
          "Правка",
          () => [
            {
              label: "Отменить",
              disabled: !w.undo.length,
              action: () => undoEditor(w),
            },
            {
              label: "Повторить",
              disabled: !w.redo.length,
              action: () => undoEditor(w, true),
            },
            null,
            {
              label: "Вырезать",
              disabled: editor.selectionStart === editor.selectionEnd,
              action: () => editClipboard(w, "cut"),
            },
            {
              label: "Копировать",
              disabled: editor.selectionStart === editor.selectionEnd,
              action: () => editClipboard(w, "copy"),
            },
            { label: "Вставить", action: () => editClipboard(w, "paste") },
            {
              label: "Выделить всё",
              action: () => {
                editor.focus();
                editor.select();
              },
            },
            null,
            { label: "Найти…", action: () => searchDialog(w) },
            {
              label: "Найти далее",
              disabled: !w.find,
              action: () => findNext(w),
            },
            { label: "Заменить…", action: () => searchDialog(w, true) },
            {
              label: "Дата и время",
              action: () => {
                const from = editor.selectionStart,
                  to = editor.selectionEnd,
                  text = new Date().toLocaleString("ru-RU");
                editorValue(
                  w,
                  editor.value.slice(0, from) + text + editor.value.slice(to),
                );
                editor.focus();
              },
            },
          ],
        ],
        [
          "Вид",
          () => [
            {
              label: "Перенос строк",
              action: () => {
                w.wrap = !w.wrap;
                editor.wrap = w.wrap ? "soft" : "off";
              },
            },
            {
              label: "Увеличить шрифт",
              disabled: w.zoom >= 24,
              action: () => {
                w.zoom += 1;
                editor.style.fontSize = w.zoom + "px";
              },
            },
            {
              label: "Уменьшить шрифт",
              disabled: w.zoom <= 10,
              action: () => {
                w.zoom -= 1;
                editor.style.fontSize = w.zoom + "px";
              },
            },
          ],
        ],
        [
          "Справка",
          () => [
            { label: "Справка Windows 95", action: () => openApp("help") },
            {
              label: "О Блокноте",
              action: () =>
                popup(
                  "О Блокноте",
                  "<p>Текстовый редактор. Документы автоматически сохраняются в браузере; скачивайте .txt для отдельной копии.</p>",
                ),
            },
          ],
        ],
      ]),
    );
    const area = document.createElement("div");
    area.className = "notepad-workspace";
    area.append(editor);
    w.content.append(area);
    const status = document.createElement("div");
    status.className = "editor-status";
    status.dataset.editorStatus = "";
    w.content.append(status);
    updateEditorStatus(w);
    editor.oninput = () => {
      w.undo.push(w.lastText);
      if (w.undo.length > 100) w.undo.shift();
      w.redo = [];
      w.lastText = editor.value;
      saveEditor(w);
    };
    editor.onkeydown = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undoEditor(w, e.shiftKey);
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        undoEditor(w, true);
      }
    };
    $("[data-close]", w.el).onclick = () => requestClose(w);
  }
  function newEditorDocument(w) {
    const node = attempt(() =>
      fs.create(currentParent(w), "file", "Новый документ.txt"),
    );
    if (node) {
      refresh();
      openItem(node.id);
    }
  }
  async function saveCopy(w) {
    const result = await popup(
      "Сохранить копию",
      '<label class="field">Имя<input name="name" value="' +
        escape(fs.get(w.fileId).name) +
        '" required></label>',
      [
        { label: "Сохранить", value: "save" },
        { label: "Отмена", value: "cancel" },
      ],
    );
    if (result?.action === "save") {
      const node = attempt(() =>
        fs.create(
          currentParent(w),
          "file",
          result.name,
          $("[data-doc-editor]", w.el).value,
        ),
      );
      if (node) {
        refresh();
        openItem(node.id);
      }
    }
  }
  async function requestClose(w) {
    if (w.unsaved && !saveEditor(w)) {
      const result = await popup(
        "Документ не сохранён",
        "<p>Не удалось сохранить последние изменения. Скачайте документ перед закрытием.</p>",
        [
          { label: "Скачать .txt", value: "download" },
          { label: "Остаться", value: "cancel" },
        ],
      );
      if (result?.action === "download")
        download(fs.get(w.fileId).name, $("[data-doc-editor]", w.el).value);
      return;
    }
    closeWindow(w);
  }
  async function searchDialog(w, replace = false) {
    const editor = $("[data-doc-editor]", w.el),
      selected = editor.value.slice(editor.selectionStart, editor.selectionEnd);
    const result = await popup(
      replace ? "Замена" : "Поиск",
      `<label class="field">Найти<input name="find" value="${escape(selected || w.find)}" required></label>${replace ? '<label class="field">Заменить на<input name="replacement"></label>' : ""}<label class="check-field"><input name="caseSensitive" type="checkbox">Учитывать регистр</label>`,
      replace
        ? [
            { label: "Заменить все", value: "replace" },
            { label: "Отмена", value: "cancel" },
          ]
        : [
            { label: "Найти далее", value: "find" },
            { label: "Отмена", value: "cancel" },
          ],
    );
    if (!result || result.action === "cancel") return;
    w.find = result.find;
    w.caseSensitive = !!result.caseSensitive;
    if (result.action === "replace") {
      const escaped = result.find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      let count = 0;
      const text = editor.value.replace(
        new RegExp(escaped, w.caseSensitive ? "g" : "gi"),
        () => {
          count++;
          return result.replacement;
        },
      );
      if (count) editorValue(w, text);
      notify(count ? `Заменено: ${count}` : "Текст не найден");
      editor.focus();
    } else findNext(w);
  }
  function findNext(w) {
    if (!w.find) return searchDialog(w);
    const editor = $("[data-doc-editor]", w.el),
      text = w.caseSensitive
        ? editor.value
        : editor.value.toLocaleLowerCase("ru"),
      query = w.caseSensitive ? w.find : w.find.toLocaleLowerCase("ru");
    let from = text.indexOf(query, editor.selectionEnd);
    if (from < 0) from = text.indexOf(query);
    editor.focus();
    if (from < 0) notify("Текст не найден");
    else {
      editor.setSelectionRange(from, from + w.find.length);
      const line = editor.value.slice(0, from).split("\n").length;
      editor.scrollTop = Math.max(
        0,
        (line - 3) * (parseFloat(getComputedStyle(editor).lineHeight) || 18),
      );
    }
  }
  function importFiles(parent) {
    importParent = parent;
    $("#import-file").value = "";
    $("#import-file").click();
  }
  $("#import-file").onchange = async (e) => {
    for (const file of e.target.files) {
      if (!/\.txt$/i.test(file.name)) {
        notify("Можно импортировать только текстовые файлы .txt.");
        continue;
      }
      if (file.size > 2 * 1024 * 1024) {
        notify("Файл слишком большой. Максимальный размер — 2 МБ.");
        continue;
      }
      try {
        const content = await file.text(),
          parent = fs.isAvailable(importParent) ? importParent : "desktop",
          node = fs.create(parent, "file", file.name, content);
        refresh();
        openItem(node.id);
      } catch (error) {
        notify(error.message);
      }
    }
  };
  const calcKeys = [
    ["mc", "MC"],
    ["7", "7"],
    ["8", "8"],
    ["9", "9"],
    ["/", "/"],
    ["sqrt", "√"],
    ["mr", "MR"],
    ["4", "4"],
    ["5", "5"],
    ["6", "6"],
    ["*", "×"],
    ["%", "%"],
    ["ms", "MS"],
    ["1", "1"],
    ["2", "2"],
    ["3", "3"],
    ["-", "−"],
    ["reciprocal", "1/x"],
    ["m-plus", "M+"],
    ["0", "0"],
    ["sign", "+/−"],
    [".", "."],
    ["+", "+"],
    ["=", "="],
  ];
  function renderCalculator(w) {
    w.calc = new Win95Calculator.Calculator();
    w.content.className = "window-content explorer-shell calc95-shell";
    w.content.append(
      menubar(w, [
        [
          "Правка",
          () => [
            {
              label: "Копировать число",
              action: () => copyText(w.calc.display),
            },
            {
              label: "Вставить число",
              action: async () => {
                const text = await readText();
                if (text !== null) {
                  attempt(() => w.calc.paste(text));
                  updateCalc(w);
                }
              },
            },
          ],
        ],
        [
          "Вид",
          () => [
            {
              label: "Обычный",
              action: () => {
                if (w.maximized) maximize(w);
                w.el.style.width = "368px";
                w.el.style.height = "420px";
                clampWindow(w);
              },
            },
            { label: "Очистить вычисление", action: () => calcPress(w, "C") },
          ],
        ],
        [
          "Справка",
          () => [
            {
              label: "О калькуляторе",
              action: () =>
                popup(
                  "Калькулятор",
                  "<p>Вводите числа и + − * / с клавиатуры. Enter — результат, Esc — сброс, Backspace — удалить цифру. Проценты при сложении считаются от первого числа, при умножении — как доля. F9 — сменить знак.</p>",
                ),
            },
          ],
        ],
      ]),
    );
    const area = document.createElement("div");
    area.className = "calc95-workspace";
    area.innerHTML = `<output class="calculator-display" data-calc-display aria-live="polite">0</output><div class="calc95-top-row"><div class="calc95-memory-indicator" data-calc-memory></div><div class="calc95-top-actions"><button class="win95-btn calc95-btn calc95-btn--danger" data-calc="Backspace">Back</button><button class="win95-btn calc95-btn calc95-btn--danger" data-calc="CE">CE</button><button class="win95-btn calc95-btn calc95-btn--danger" data-calc="C">C</button></div></div><div class="calculator-grid">${calcKeys.map(([token, label]) => `<button class="win95-btn calc95-btn ${/^\d$/.test(token) ? "calc95-btn--digit" : token.startsWith("m") ? "calc95-btn--danger" : "calc95-btn--op"}" data-calc="${escape(token)}">${label}</button>`).join("")}</div>`;
    area.onclick = (e) => {
      const button = e.target.closest("[data-calc]");
      if (button) calcPress(w, button.dataset.calc);
    };
    w.content.append(area);
  }
  function updateCalc(w) {
    $("[data-calc-display]", w.el).textContent = w.calc.display;
    $("[data-calc-memory]", w.el).textContent = w.calc.memory !== 0 ? "M" : "";
  }
  function calcPress(w, token) {
    w.calc.press(token);
    updateCalc(w);
  }
  function renderSettings(w) {
    w.content.className = "window-content utility-content";
    w.content.innerHTML = `<form class="settings-form"><h2>Оформление рабочего стола</h2><label class="field">Цвет рабочего стола<input type="color" name="color" value="${state.settings.color}"></label><label class="field">Шрифт<select name="font"><option value="Tiny5">Tiny5 — пиксельный</option><option value="Tahoma">Tahoma — классический</option><option value="monospace">Моноширинный</option></select></label><label class="check-field"><input name="clock24" type="checkbox" ${state.settings.clock24 ? "checked" : ""}>24-часовой формат времени</label><div class="settings-preview">Windows 95 — Мой рабочий стол</div><p>Документы сохраняются в этом браузере. Для отдельной копии скачайте .txt в Блокноте.</p><div class="settings-actions"><button class="win95-btn" type="submit">Применить</button><button class="win95-btn" type="button" data-defaults>По умолчанию</button></div></form>`;
    $("[name=font]", w.el).value = state.settings.font;
    const preview = () => {
      const form = $("form", w.el);
      $(".settings-preview", w.el).style.backgroundColor =
        form.elements.color.value;
      $(".settings-preview", w.el).style.fontFamily = form.elements.font.value;
    };
    $("form", w.el).oninput = preview;
    preview();
    $("form", w.el).onsubmit = (e) => {
      e.preventDefault();
      const form = e.currentTarget,
        next = {
          color: form.elements.color.value,
          font: form.elements.font.value,
          clock24: form.elements.clock24.checked,
        };
      try {
        localStorage.setItem(SETTINGS, JSON.stringify(next));
        state.settings = next;
        applySettings();
        notify("Настройки сохранены");
      } catch (_) {
        notify("Не удалось сохранить настройки.");
      }
    };
    $("[data-defaults]", w.el).onclick = () => {
      const form = $("form", w.el);
      form.elements.color.value = "#008080";
      form.elements.font.value = "Tiny5";
      form.elements.clock24.checked = true;
      preview();
    };
  }
  function renderHelp(w) {
    w.content.className = "window-content utility-content help-content";
    w.content.innerHTML = `<h1>Windows 95 в браузере</h1><p>Ваш рабочий стол с папками, текстовыми документами и калькулятором.</p><h2>Файлы и папки</h2><p>Двойной щелчок открывает объект. Правая кнопка мыши открывает команды. Создавайте папки и документы, копируйте и переносите их через буфер обмена. «Мой компьютер» показывает диск C: и основные папки. В корзине доступны восстановление и окончательное удаление.</p><h2>Блокнот</h2><p>Текст сохраняется автоматически. Меню «Файл» позволяет импортировать и скачать .txt. В меню «Правка» есть поиск, замена и отмена. Системный буфер обмена может потребовать разрешения браузера.</p><h2>Окна</h2><p>Перетаскивайте за заголовок, меняйте размер за правый нижний угол. Двойной щелчок по заголовку разворачивает окно. Кнопки панели задач сворачивают и восстанавливают приложения.</p><h2>Клавиатура</h2><dl class="shortcut-list"><dt>Enter</dt><dd>Открыть выбранный объект</dd><dt>F2 / Delete</dt><dd>Переименовать / отправить в корзину</dd><dt>Ctrl/⌘ + C, X, V</dt><dd>Копировать, вырезать, вставить</dd><dt>Ctrl/⌘ + N</dt><dd>Новый документ</dd><dt>Ctrl/⌘ + Shift + N</dt><dd>Новая папка</dd><dt>Ctrl/⌘ + S / O</dt><dd>Сохранить / импортировать .txt</dd><dt>Ctrl/⌘ + F / H</dt><dd>Поиск / замена в Блокноте</dd><dt>Ctrl/⌘ + Z / Shift + Z</dt><dd>Отмена / повтор</dd><dt>Ctrl + Tab</dt><dd>Следующее окно внутри страницы</dd><dt>Alt + F4</dt><dd>Закрыть активное окно, если браузер передаёт сочетание странице</dd><dt>F1 / Esc</dt><dd>Справка / закрыть меню</dd><dt>Shift + F10</dt><dd>Контекстное меню выбранного объекта</dd></dl><h2>Хранение данных</h2><p>Документы находятся только в этом браузере и на этом адресе сайта. Очистка данных сайта удалит их. Скачивайте важные тексты. Старые документы и корзина переносятся автоматически, их исходные записи остаются резервной копией.</p><p>Завершение работы выключает виртуальный рабочий стол. Вернуться можно кнопкой «Включить компьютер».</p>`;
  }
  function startPage(page = "main") {
    const entries =
      page === "main"
        ? [
            ["programs", "Программы", () => startPage("programs")],
            ["folder", "Документы", () => startPage("documents")],
            ["settings", "Настройки", () => openApp("settings")],
            ["help", "Справка", () => openApp("help")],
            null,
            ["computer", "Мой компьютер", () => openApp("computer")],
            ["bin", "Корзина", () => openApp("bin")],
            null,
            ["shutdown", "Завершение работы", () => shutdown()],
          ]
        : page === "programs"
          ? [
              ["folder", "Назад", () => startPage()],
              ["notepad", "Блокнот", () => openApp("notepad")],
              ["calculator", "Калькулятор", () => openApp("calculator")],
              ["computer", "Проводник", () => openApp("computer")],
            ]
          : [
              ["folder", "Назад", () => startPage()],
              [
                "folder",
                "Мои документы",
                () => {
                  hideStart();
                  openFolder("documents");
                },
              ],
              ...recentDocuments().map((n) => [
                "file",
                n.name,
                () => openItem(n.id),
              ]),
            ];
    start.innerHTML =
      '<div class="start-menu-side">Windows95</div><div class="start-menu-main"></div>';
    const main = $(".start-menu-main", start);
    entries.forEach((entry) => {
      if (!entry) {
        const hr = document.createElement("div");
        hr.className = "start-menu-separator";
        main.append(hr);
        return;
      }
      const [type, name, action] = entry,
        button = document.createElement("button");
      button.className = "start-menu-item";
      button.innerHTML = `${image(type === "bin" && fs.trashItems().length ? "full" : type, "start-menu-item-icon")}<span class="start-menu-item-text">${escape(name)}</span>`;
      button.onclick = action;
      main.append(button);
    });
    start.classList.remove("hidden");
    start.style.zIndex = String(++state.z);
    startButton.classList.add("active");
    startButton.setAttribute("aria-expanded", "true");
    main.querySelector("button")?.focus();
  }
  function recentDocuments() {
    const files = [];
    const visit = (id) => {
      for (const n of fs.list(id)) {
        if (n.type === "folder") visit(n.id);
        else files.push(n);
      }
    };
    visit("root");
    return files.sort((a, b) => b.modifiedAt - a.modifiedAt).slice(0, 8);
  }
  async function shutdown() {
    hideStart();
    const dirty = [...state.windows.values()].find((w) => w.unsaved);
    if (dirty) {
      focusWindow(dirty);
      notify(
        "Сначала сохраните или скачайте документ с несохранёнными изменениями.",
      );
      return;
    }
    const result = await popup(
      "Завершение работы",
      "<p>Завершить работу виртуального компьютера? Сохранённые документы останутся в браузере.</p>",
      [
        { label: "Завершить работу", value: "shutdown" },
        { label: "Отмена", value: "cancel" },
      ],
    );
    if (result?.action === "shutdown") {
      for (const w of [...state.windows.values()]) closeWindow(w);
      $("#shutdown-screen").classList.remove("hidden");
      $("#ui-root").inert = true;
      $("#power-on").focus();
    }
  }
  $("#power-on").onclick = () => {
    $("#shutdown-screen").classList.add("hidden");
    $("#ui-root").inert = false;
    startButton.focus();
  };
  grid.tabIndex = 0;
  grid.onclick = (e) => {
    if (!e.target.closest(".desktop-icon")) select(null, "desktop");
  };
  grid.oncontextmenu = (e) => {
    e.preventDefault();
    const id = e.target.closest("[data-id]")?.dataset.id;
    if (id) select(id, "desktop");
    else select(null, "desktop");
    showMenu(
      id ? fileItems(id, "desktop") : folderItems("desktop"),
      e.clientX,
      e.clientY,
    );
  };
  startButton.onclick = () => {
    hideMenus();
    if (start.classList.contains("hidden")) startPage();
    else hideStart();
  };
  startButton.onkeydown = (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      startPage();
    }
  };
  document.addEventListener("pointerdown", (e) => {
    if (
      !commandMenu.contains(e.target) &&
      !e.target.closest(".app-menu-button")
    )
      hideMenus();
    if (!start.contains(e.target) && !startButton.contains(e.target))
      hideStart();
  });
  tasks.onwheel = (e) => {
    if (tasks.scrollWidth > tasks.clientWidth) {
      e.preventDefault();
      tasks.scrollLeft += e.deltaY || e.deltaX;
    }
  };
  $("#clock").onclick = () =>
    popup(
      "Дата и время",
      `<p>${escape(new Date().toLocaleString("ru-RU", { dateStyle: "full", timeStyle: "short" }))}</p><p>Время соответствует настройкам вашего устройства.</p>`,
    );
  window.addEventListener("beforeunload", (e) => {
    if ([...state.windows.values()].some((w) => w.unsaved)) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  window.addEventListener("resize", () => {
    for (const w of state.windows.values()) clampWindow(w);
    grid.querySelectorAll(".desktop-icon").forEach(positionIcon);
    hideMenus();
  });
  document.addEventListener("keydown", async (e) => {
    if (dialog.open || !$("#shutdown-screen").classList.contains("hidden"))
      return;
    if (
      !commandMenu.classList.contains("hidden") ||
      !start.classList.contains("hidden")
    ) {
      const menu = commandMenu.classList.contains("hidden")
        ? start
        : commandMenu;
      const buttons = [...menu.querySelectorAll("button:not(:disabled)")],
        index = buttons.indexOf(document.activeElement);
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
        e.preventDefault();
        const next =
          e.key === "Home"
            ? 0
            : e.key === "End"
              ? buttons.length - 1
              : (index + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) %
                buttons.length;
        buttons[next]?.focus();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        hideMenus(true);
        hideStart();
        return;
      }
    }
    const w = currentWindow(),
      editing =
        e.target.matches("textarea,input,select") || e.target.isContentEditable,
      mod = e.ctrlKey || e.metaKey,
      key = e.key.toLowerCase();
    if (e.key === "F1") {
      e.preventDefault();
      openApp("help");
      return;
    }
    if (e.key === "Escape") {
      hideMenus(true);
      hideStart();
      if (w?.kind === "calculator") calcPress(w, "C");
      return;
    }
    if ((e.ctrlKey || e.altKey) && e.key === "Tab") {
      e.preventDefault();
      const windows = [...state.windows.values()];
      if (windows.length) {
        let index = windows.indexOf(w);
        index =
          (index + (e.shiftKey ? -1 : 1) + windows.length) % windows.length;
        focusWindow(windows[index]);
      }
      return;
    }
    if (e.altKey && e.key === "F4" && w) {
      e.preventDefault();
      await requestClose(w);
      return;
    }
    if (mod && key === "n") {
      e.preventDefault();
      if (e.shiftKey) await askName(null, "folder", currentParent());
      else if (w?.kind === "notepad") newEditorDocument(w);
      else await askName(null, "file", currentParent());
      return;
    }
    if (mod && key === "o") {
      e.preventDefault();
      importFiles(currentParent());
      return;
    }
    if (w?.kind === "notepad") {
      if (mod && key === "s") {
        e.preventDefault();
        if (e.shiftKey)
          download(fs.get(w.fileId).name, $("[data-doc-editor]", w.el).value);
        else saveEditor(w);
        return;
      }
      if (mod && (key === "f" || key === "h")) {
        e.preventDefault();
        await searchDialog(w, key === "h");
        return;
      }
      if (e.key === "F3") {
        e.preventDefault();
        findNext(w);
        return;
      }
    }
    if (editing) return;
    // Enter activates the focused control; calculator input only owns the window surface.
    if (e.key === "Enter" && e.target.closest("button")) return;
    if (w?.kind === "calculator" && !mod && !e.altKey) {
      const token = e.key === "F9" ? "sign" : e.key === "Delete" ? "CE" : e.key;
      if (
        /^\d$/.test(token) ||
        [
          "+",
          "-",
          "*",
          "/",
          "%",
          ".",
          ",",
          "=",
          "Enter",
          "Backspace",
          "CE",
          "sign",
        ].includes(token)
      ) {
        e.preventDefault();
        calcPress(w, token);
        return;
      }
    }
    if (w?.kind === "calculator" && mod && key === "c") {
      e.preventDefault();
      await copyText(w.calc.display);
      return;
    }
    if (w?.kind === "calculator" && mod && key === "v") {
      e.preventDefault();
      const text = await readText();
      if (text !== null) {
        attempt(() => w.calc.paste(text));
        updateCalc(w);
      }
      return;
    }
    const selected = currentSelection();
    if (
      e.key === "F2" &&
      selected &&
      !selected.startsWith("app:") &&
      !fs.get(selected)?.protected &&
      w?.kind !== "bin"
    ) {
      e.preventDefault();
      await askName(selected);
    } else if (e.key === "Delete" && selected) {
      e.preventDefault();
      if (w?.kind === "bin") await confirmRemoval(selected);
      else trashFile(selected);
    } else if (
      mod &&
      ["c", "x"].includes(key) &&
      selected &&
      w?.kind !== "bin"
    ) {
      e.preventDefault();
      copyFile(selected, key === "x");
    } else if (mod && key === "v" && (!w || w.kind === "explorer")) {
      e.preventDefault();
      pasteFile(currentParent());
    } else if (e.key === "Enter" && selected && !e.target.closest("button")) {
      e.preventDefault();
      if (w?.kind === "bin") restoreFile(selected);
      else openItem(selected);
    } else if ((e.shiftKey && e.key === "F10") || e.key === "ContextMenu") {
      e.preventDefault();
      const el = (w?.el || grid).querySelector(
          `[data-id="${CSS.escape(selected || "")}"]`,
        ),
        rect = (el || w?.el || grid).getBoundingClientRect();
      showMenu(
        selected
          ? fileItems(selected, currentParent(), w?.kind === "bin")
          : folderItems(currentParent()),
        rect.left + 20,
        rect.top + 20,
      );
    } else if (e.key === "F5") {
      e.preventDefault();
      refresh();
    } else if (
      e.key.startsWith("Arrow") &&
      (!w || w.kind === "explorer" || w.kind === "bin")
    ) {
      const container = w ? $(".explorer-workspace", w.el) : grid,
        buttons = [...container.querySelectorAll("[data-id]")];
      if (!buttons.length) return;
      e.preventDefault();
      const index = buttons.findIndex((b) => b.dataset.id === selected),
        delta = ["ArrowDown", "ArrowRight"].includes(e.key) ? 1 : -1;
      const button = buttons[(index + delta + buttons.length) % buttons.length];
      select(button.dataset.id, w?.key || "desktop");
      button.focus();
    }
  });
  applySettings();
  setInterval(updateClock, 1000);
  renderDesktop();
})();
