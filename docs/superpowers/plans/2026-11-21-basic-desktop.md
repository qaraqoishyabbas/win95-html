# Basic Desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Finish the approved local Windows 95 desktop.
**Architecture:** UMD modules expose a persistent filesystem and calculator to the browser and Node tests. The existing app becomes a shared UI for desktop, Explorer, Notepad, and utilities, reusing existing CSS and icons.
**Tech Stack:** HTML, JavaScript, Tailwind CSS 4, Node built-in tests, browser verification.
**Spec:** docs/superpowers/specs/2026-11-21-basic-desktop-design.md

## Global Constraints
- Preserve existing text documents, recycle contents and desktop style.
- Local browser data only; no server, accounts, or synchronization.
- No destructive git operations or automatic publishing.

## Review Focus
- Deleting while editing text must only edit text.
- Moving a folder into a descendant must leave all data intact.
- Restore when the original parent is gone must preserve content on Desktop.
- Storage refusal or corrupt saved data must not silently destroy existing data.
- Small viewports and menu edges must keep controls reachable.

### Task 1: Persistent filesystem
**Files:** src/filesystem.js, tests/filesystem.test.js
**Interfaces:** new FileSystem(storage), list(parent), get(id), create(parent,type,name,content), rename(id,name), write(id,content), transfer(id,parent,copy), trash(id), restore(id), purge(id), emptyTrash(), path(id).
- [x] Write tests for migration, names, nested copy/move/trash/restore, cycles, reload and failed storage.
- [x] Run `node --test tests/filesystem.test.js`; expect failure because module is absent.
- [x] Implement model with transactional storage and legacy migration.
- [x] Run same command; expect all passing.

### Task 2: Calculator
**Files:** src/calculator.js, tests/calculator.test.js
**Interfaces:** new Calculator(), press(token), display, memory.
- [x] Write arithmetic, decimal, percent, repeat equals, error and memory tests.
- [x] Run calculator tests and observe missing-module failure.
- [x] Implement engine, then run all Node tests; expect passing.

### Task 3: Desktop and applications
**Files:** index.html, src/app.js, src/input.css, package.json, tests/browser tests
**Interfaces:** consumes FileSystem and Calculator; shared command dispatch, window and dialog controllers.
- [x] Prepare browser scenarios for document lifecycle, migration/reload, folder operations, shortcuts, menus, resizing, mobile and storage errors; run against old app and observe missing functionality.
- [x] Implement shared filesystem views and operations, menus, Notepad, calculator, settings, help and shutdown.
- [x] Add maximize/restore, resizing, focus and keyboard navigation; preserve safe text input.
- [x] Build CSS; run Node tests and browser scenarios; expect all passing.

### Task 4: Review and delivery
**Files:** README.md, plan/progress documentation.
- [x] Review diff and request independent whole-change review, fix material findings with regression tests.
- [x] Re-run unit tests, browser tests, syntax checks, CSS build, and `git diff --check`.
- [x] Document startup, controls, storage and any real limitations; deliver changes in workspace without publishing.
