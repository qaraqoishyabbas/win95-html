/* Shared by the browser and Node. Each mutation is persisted before it is exposed. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Win95FS = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const KEY = "win95_filesystem_v2";
  const clone = (value) => JSON.parse(JSON.stringify(value));
  class FileSystem {
    constructor(storage) {
      this.storage = storage;
      let raw;
      try {
        raw = storage.getItem(KEY);
      } catch (_) {
        throw Error(
          "Хранилище браузера недоступно. Разрешите доступ к локальным данным.",
        );
      }
      this.savedSnapshot = raw;
      if (raw !== null) {
        try {
          this.data = JSON.parse(raw);
          if (
            this.data.version !== 2 ||
            !this.data.nodes ||
            typeof this.data.nodes !== "object" ||
            Array.isArray(this.data.nodes)
          )
            throw Error();
          for (const id of [
            "root",
            "desktop",
            "documents",
            "dos",
            "program-files",
            "windows",
          ]) {
            const system = this.data.nodes[id];
            if (
              !system ||
              system.type !== "folder" ||
              system.protected !== true ||
              system.deletedAt ||
              system.parent !== (id === "root" ? null : "root")
            )
              throw Error();
          }
          for (const [id, node] of Object.entries(this.data.nodes)) {
            if (
              node.id !== id ||
              !["folder", "file"].includes(node.type) ||
              typeof node.name !== "string"
            )
              throw Error();
            if (
              id !== "root" &&
              this.data.nodes[node.parent]?.type !== "folder"
            )
              throw Error();
            if (node.type === "file" && typeof node.content !== "string")
              throw Error();
            const visited = new Set([id]);
            let ancestor = node.parent;
            while (ancestor) {
              if (visited.has(ancestor)) throw Error();
              visited.add(ancestor);
              ancestor = this.data.nodes[ancestor]?.parent;
            }
          }
        } catch (_) {
          throw Error(
            "Сохранённые данные повреждены. Исходные данные сохранены; экспортируйте резервную копию перед сбросом.",
          );
        }
      } else {
        this.data = { version: 2, nodes: {} };
        const folders = [
          ["root", null, "Диск C:"],
          ["desktop", "root", "Рабочий стол"],
          ["documents", "root", "Мои документы"],
          ["dos", "root", "Dos"],
          ["program-files", "root", "Program Files"],
          ["windows", "root", "Windows"],
        ];
        for (const [id, parent, name] of folders)
          this.data.nodes[id] = {
            id,
            parent,
            name,
            type: "folder",
            protected: true,
            createdAt: Date.now(),
            modifiedAt: Date.now(),
          };
        for (const [key, deleted] of [
          ["win95_text_documents_v1", false],
          ["win95_recycle_bin_v1", true],
        ]) {
          let old;
          try {
            old = JSON.parse(storage.getItem(key) || "{}");
            if (!old || typeof old !== "object" || Array.isArray(old))
              throw Error();
          } catch (_) {
            throw Error("Старые данные повреждены. Они не были перезаписаны.");
          }
          for (const [legacyId, doc] of Object.entries(old)) {
            if (
              !doc ||
              typeof doc.name !== "string" ||
              typeof doc.content !== "string"
            )
              throw Error(
                "Старые данные повреждены. Они не были перезаписаны.",
              );
            const id = this.data.nodes[legacyId] ? this.id() : legacyId;
            this.data.nodes[id] = {
              id,
              parent: "desktop",
              type: "file",
              name: this.unique("desktop", doc.name),
              content: doc.content,
              createdAt: Date.now(),
              modifiedAt: Date.now(),
              ...(deleted
                ? { deletedAt: Number(doc.deletedAt) || Date.now() }
                : {}),
            };
          }
        }
        this.persist();
      }
    }
    id() {
      return `file-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    }
    get(id) {
      const node = this.data.nodes[id];
      return node ? clone(node) : undefined;
    }
    isAvailable(id) {
      const visited = new Set();
      let node = this.data.nodes[id];
      if (!node) return false;
      while (node) {
        if (node.deletedAt || visited.has(node.id)) return false;
        visited.add(node.id);
        node = this.data.nodes[node.parent];
      }
      return true;
    }
    list(parent) {
      if (!this.isAvailable(parent)) return [];
      return Object.values(this.data.nodes)
        .filter((n) => n.parent === parent && !n.deletedAt)
        .sort((a, b) =>
          a.type === b.type
            ? a.name.localeCompare(b.name, "ru", { numeric: true })
            : a.type === "folder"
              ? -1
              : 1,
        )
        .map(clone);
    }
    trashItems() {
      return Object.values(this.data.nodes)
        .filter((n) => n.deletedAt)
        .sort((a, b) => b.deletedAt - a.deletedAt)
        .map(clone);
    }
    descendants(id) {
      const result = [];
      const visit = (parent) => {
        for (const n of Object.values(this.data.nodes))
          if (n.parent === parent) {
            result.push(n.id);
            visit(n.id);
          }
      };
      visit(id);
      return result;
    }
    path(id) {
      const parts = [];
      let node = this.data.nodes[id];
      while (node) {
        parts.unshift(node.name);
        node = this.data.nodes[node.parent];
      }
      return parts.join(" / ");
    }
    normalize(name, type) {
      let next =
        String(name || "").trim() ||
        (type === "file" ? "Новый документ.txt" : "Новая папка");
      if (
        /[\\/:*?"<>|\u0000-\u001f]/.test(next) ||
        /^\.+$/.test(next) ||
        next.length > 255
      )
        throw Error(
          'Имя должно содержать до 255 символов без \\ / : * ? " < > |.',
        );
      if (type === "file" && !next.toLowerCase().endsWith(".txt"))
        next += ".txt";
      if (next.length > 255) throw Error("Имя слишком длинное.");
      return next;
    }
    unique(parent, name, exclude = null) {
      const existing = new Set(
        Object.values(this.data.nodes)
          .filter(
            (n) => n.parent === parent && n.id !== exclude && !n.deletedAt,
          )
          .map((n) => n.name.toLocaleLowerCase("ru")),
      );
      if (!existing.has(name.toLocaleLowerCase("ru"))) return name;
      const dot = name.toLowerCase().endsWith(".txt") ? name.length - 4 : -1;
      const base = dot < 0 ? name : name.slice(0, dot);
      const ext = dot < 0 ? "" : ".txt";
      let n = 2;
      while (existing.has(`${base} (${n})${ext}`.toLocaleLowerCase("ru"))) n++;
      return `${base} (${n})${ext}`;
    }
    parent(id) {
      if (!this.isAvailable(id) || this.data.nodes[id].type !== "folder")
        throw Error("Папка назначения недоступна.");
    }
    editable(id) {
      const n = this.data.nodes[id];
      if (!n || n.protected)
        throw Error("Этот системный объект нельзя изменить.");
      return n;
    }
    persist() {
      let latest;
      try {
        latest = this.storage.getItem(KEY);
      } catch (_) {
        throw Error(
          "Не удалось прочитать хранилище браузера. Операция отменена.",
        );
      }
      if (latest !== this.savedSnapshot)
        throw Error(
          "Данные изменились в другой вкладке. Перезагрузите страницу перед продолжением; несохранённый текст можно скачать.",
        );
      const snapshot = JSON.stringify(this.data);
      try {
        this.storage.setItem(KEY, snapshot);
        this.savedSnapshot = snapshot;
      } catch (_) {
        throw Error(
          "Не удалось сохранить данные. Возможно, закончилось место в браузере. Операция отменена.",
        );
      }
    }
    transaction(fn) {
      const before = clone(this.data);
      try {
        const value = fn();
        this.persist();
        return clone(value ?? null);
      } catch (error) {
        this.data = before;
        throw error;
      }
    }
    create(parent, type, name, content = "") {
      return this.transaction(() => {
        this.parent(parent);
        if (!["file", "folder"].includes(type))
          throw Error("Неизвестный тип файла.");
        const node = {
          id: this.id(),
          parent,
          type,
          name: this.unique(parent, this.normalize(name, type)),
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        };
        if (type === "file") node.content = String(content);
        this.data.nodes[node.id] = node;
        return node;
      });
    }
    rename(id, name) {
      return this.transaction(() => {
        const n = this.editable(id);
        if (!this.isAvailable(id)) throw Error("Объект находится в корзине.");
        n.name = this.unique(n.parent, this.normalize(name, n.type), id);
        n.modifiedAt = Date.now();
        return n;
      });
    }
    write(id, content) {
      return this.transaction(() => {
        const n = this.editable(id);
        if (n.type !== "file" || !this.isAvailable(id))
          throw Error("Файл недоступен.");
        n.content = String(content);
        n.modifiedAt = Date.now();
        return n;
      });
    }
    transfer(id, parent, copy = false) {
      return this.transaction(() => {
        this.parent(parent);
        const node = this.editable(id);
        if (!this.isAvailable(id)) throw Error("Объект находится в корзине.");
        if (id === parent || this.descendants(id).includes(parent))
          throw Error("Нельзя поместить папку внутрь самой себя.");
        if (!copy) {
          node.name = this.unique(parent, node.name, id);
          node.parent = parent;
          node.modifiedAt = Date.now();
          return node;
        }
        const copyTree = (source, target) => {
          const fresh = {
            ...source,
            id: this.id(),
            parent: target,
            createdAt: Date.now(),
            modifiedAt: Date.now(),
          };
          delete fresh.deletedAt;
          delete fresh.protected;
          fresh.name = this.unique(target, source.name);
          this.data.nodes[fresh.id] = fresh;
          const children = Object.values(this.data.nodes).filter(
            (n) => n.parent === source.id && !n.deletedAt,
          );
          for (const child of children) copyTree(child, fresh.id);
          return fresh;
        };
        return copyTree(node, parent);
      });
    }
    trash(id) {
      return this.transaction(() => {
        const n = this.editable(id);
        if (!this.isAvailable(id)) throw Error("Объект уже удалён.");
        n.deletedAt = Date.now();
        return n;
      });
    }
    restore(id) {
      return this.transaction(() => {
        const n = this.editable(id);
        if (!n.deletedAt) throw Error("Объект не находится в корзине.");
        if (!this.isAvailable(n.parent)) n.parent = "desktop";
        n.name = this.unique(n.parent, n.name, id);
        delete n.deletedAt;
        return n;
      });
    }
    purge(id) {
      return this.transaction(() => {
        const n = this.editable(id);
        if (!n.deletedAt) throw Error("Сначала переместите объект в корзину.");
        // Independently trashed children have their own recovery location and must survive.
        const remove = (parent) => {
          for (const child of Object.values(this.data.nodes))
            if (child.parent === parent) {
              if (child.deletedAt) child.parent = "desktop";
              else {
                remove(child.id);
                delete this.data.nodes[child.id];
              }
            }
        };
        remove(id);
        delete this.data.nodes[id];
      });
    }
    emptyTrash() {
      return this.transaction(() => {
        const roots = this.trashItems();
        const remove = (id) => {
          for (const child of Object.values(this.data.nodes))
            if (child.parent === id) remove(child.id);
          delete this.data.nodes[id];
        };
        for (const n of roots) remove(n.id);
      });
    }
    size(id) {
      const n = this.get(id);
      if (!n) return 0;
      if (n.type === "file")
        return new TextEncoder().encode(n.content || "").length;
      return Object.values(this.data.nodes)
        .filter((child) => child.parent === id && !child.deletedAt)
        .reduce((total, child) => total + this.size(child.id), 0);
    }
  }
  return { FileSystem, KEY };
});
