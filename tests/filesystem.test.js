const { test } = require("node:test");
const assert = require("node:assert/strict");
const { FileSystem } = require("../src/filesystem.js");
const storage = (seed = {}) => ({
  data: { ...seed },
  getItem(k) {
    return this.data[k] ?? null;
  },
  setItem(k, v) {
    this.data[k] = v;
  },
});

test("migrates existing documents and trash without altering legacy backup", () => {
  const s = storage({
    win95_text_documents_v1: JSON.stringify({
      "doc-old": { name: "Заметка.txt", content: "Привет <мир>" },
    }),
    win95_recycle_bin_v1: JSON.stringify({
      "doc-bin": { name: "Удалён.txt", content: "вернуть", deletedAt: 123 },
    }),
  });
  const fs = new FileSystem(s);
  assert.equal(fs.get("doc-old").content, "Привет <мир>");
  assert.equal(
    fs.list("desktop").some((x) => x.id === "doc-old"),
    true,
  );
  assert.equal(fs.trashItems()[0].content, "вернуть");
  fs.restore("doc-bin");
  assert.equal(new FileSystem(s).get("doc-bin").content, "вернуть");
  assert.match(s.data.win95_text_documents_v1, /Привет/);
});
test("assigns unique case-insensitive names within a directory and preserves extension", () => {
  const fs = new FileSystem(storage());
  const a = fs.create("desktop", "file", "Note", "a");
  const b = fs.create("desktop", "file", "note.txt", "b");
  assert.equal(a.name, "Note.txt");
  assert.equal(b.name, "note (2).txt");
  const dir = fs.create("desktop", "folder", "Folder");
  assert.equal(fs.create(dir.id, "file", "Note").name, "Note.txt");
  assert.throws(() => fs.rename(dir.id, "../x"));
  assert.equal(fs.rename(a.id, "").name, "Новый документ.txt");
});
test("copies folder trees independently and rejects cyclic moves and copies", () => {
  const fs = new FileSystem(storage());
  const a = fs.create("desktop", "folder", "A");
  const b = fs.create(a.id, "folder", "B");
  const f = fs.create(b.id, "file", "x", "original");
  assert.throws(() => fs.transfer(a.id, b.id, false));
  assert.throws(() => fs.transfer(a.id, b.id, true));
  const copy = fs.transfer(a.id, "desktop", true);
  const cb = fs.list(copy.id)[0];
  const cf = fs.list(cb.id)[0];
  fs.write(cf.id, "changed");
  assert.equal(fs.get(f.id).content, "original");
  assert.equal(copy.name, "A (2)");
  fs.transfer(f.id, "documents", false);
  assert.equal(fs.list(b.id).length, 0);
  assert.equal(fs.get(f.id).parent, "documents");
});
test("trashes and restores whole trees; falls back to desktop for missing original parent", () => {
  const fs = new FileSystem(storage());
  const parent = fs.create("desktop", "folder", "Parent");
  const dir = fs.create(parent.id, "folder", "Child");
  const f = fs.create(dir.id, "file", "Data", "safe");
  fs.trash(dir.id);
  assert.equal(fs.isAvailable(f.id), false);
  assert.equal(fs.trashItems().length, 1);
  fs.trash(parent.id);
  fs.purge(parent.id);
  fs.restore(dir.id);
  assert.equal(fs.get(dir.id).parent, "desktop");
  assert.equal(fs.get(f.id).content, "safe");
  assert.equal(fs.isAvailable(f.id), true);
  fs.trash(dir.id);
  fs.emptyTrash();
  assert.equal(fs.get(f.id), undefined);
});
test("restores with collision-safe name and protects system folders", () => {
  const fs = new FileSystem(storage());
  const f = fs.create("desktop", "file", "a", "old");
  fs.trash(f.id);
  fs.create("desktop", "file", "a", "new");
  assert.equal(fs.restore(f.id).name, "a (2).txt");
  assert.throws(() => fs.trash("desktop"));
  assert.throws(() => fs.rename("documents", "x"));
});
test("storage failure rolls back an edit and keeps previously saved text", () => {
  const s = storage();
  const fs = new FileSystem(s);
  const f = fs.create("desktop", "file", "safe", "saved");
  s.setItem = () => {
    throw Error("quota");
  };
  assert.throws(() => fs.write(f.id, "lost"), /сохран/i);
  assert.equal(fs.get(f.id).content, "saved");
  assert.equal(new FileSystem(s).get(f.id).content, "saved");
});
test("corrupt new data is reported and never overwritten", () => {
  const s = storage({ win95_filesystem_v2: "{bad" });
  assert.throws(() => new FileSystem(s), /поврежд/i);
  assert.equal(s.getItem("win95_filesystem_v2"), "{bad");
});
test("rejects invalid parents and oversized or invalid names without mutation", () => {
  const fs = new FileSystem(storage());
  const f = fs.create("desktop", "file", "x");
  assert.throws(() => fs.create(f.id, "file", "no"));
  assert.throws(() => fs.create("missing", "folder", "no"));
  assert.throws(() => fs.create("desktop", "folder", "a/b"));
  assert.throws(() => fs.create("desktop", "folder", "x".repeat(256)));
  assert.equal(fs.list("desktop").length, 1);
});
test("folder size includes trashed content but excludes separately trashed descendants", () => {
  const fs = new FileSystem(storage());
  const folder = fs.create("desktop", "folder", "Size");
  const nested = fs.create(folder.id, "folder", "Nested");
  fs.create(nested.id, "file", "a", "Привет");
  const separate = fs.create(folder.id, "file", "b", "12345");
  fs.trash(separate.id);
  fs.trash(folder.id);
  assert.equal(fs.size(folder.id), 12);
  assert.equal(fs.size(separate.id), 5);
});
test("stale browser tabs cannot overwrite newer documents", () => {
  const s = storage();
  const first = new FileSystem(s),
    second = new FileSystem(s);
  first.create("desktop", "file", "from-first", "safe");
  assert.throws(
    () => second.create("desktop", "file", "from-second", "stale"),
    /вкладк/i,
  );
  assert.equal(new FileSystem(s).list("desktop")[0].content, "safe");
});
test("invalid document content and missing system-folder protections are rejected without rewriting", () => {
  const s = storage();
  const fs = new FileSystem(s);
  const f = fs.create("desktop", "file", "valid", "text");
  const data = JSON.parse(s.data.win95_filesystem_v2);
  data.nodes[f.id].content = { bad: true };
  s.data.win95_filesystem_v2 = JSON.stringify(data);
  const raw = s.data.win95_filesystem_v2;
  assert.throws(() => new FileSystem(s), /поврежд/i);
  assert.equal(s.data.win95_filesystem_v2, raw);
  data.nodes[f.id].content = "text";
  delete data.nodes.desktop.protected;
  s.data.win95_filesystem_v2 = JSON.stringify(data);
  assert.throws(() => new FileSystem(s), /поврежд/i);
});
