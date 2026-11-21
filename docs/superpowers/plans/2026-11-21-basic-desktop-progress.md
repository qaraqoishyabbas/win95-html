# SDD ledger — plan: docs/superpowers/plans/2026-11-21-basic-desktop.md
Pre-flight: Tasks 1 and 2 expose UMD globals and CommonJS exports, Task 3 consumes those exact APIs. No conflicts.
Ruling: Execute in current checkout with a feature branch when permitted; no additional worktree or approval round — user explicitly approved implementation here.
Ruling: Keep code changes uncommitted for desktop review; no merge, push or deployment is requested.
Task 1: complete — filesystem tests observed RED (module absent) → GREEN, 8 passing.
Task 2: complete — calculator tests observed RED (module absent) → GREEN, 6 passing. Percentage multiplication uses scalar percentage; repeated equals supported.
Workspace: codex/basic-desktop branch created after sandbox escalation; current checkout retained.
Task 3: complete — full 11 browser scenarios passed; added reviewer regression for calculator Enter (observed RED → GREEN).
Final review: independent reviewer /root/review_desktop found one P2 (calculator Enter intercepting controls); fixed with browser regression. No other material findings. Reviewer could not launch Chrome in its sandbox; root ran real Chrome checks with approved escalation.
Final: fixed calculator keyboard activation — calculator Enter activates menus/commands/controls RED→GREEN.
Final: fixed storage-failure deletion of unsaved drafts — browser regression RED→GREEN; also protects descendants when deleting a folder.
Final: fixed icon overlap during restore, ambiguous folder properties, menu clamping above taskbar and trash folder sizes — browser/unit regression coverage GREEN.
Ruling: File selection is single-object, file clipboard is internal to the page, and system folders are protected — agreed local baseline, no multi-selection or OS filesystem access was promised.
Ruling: Detect stale tab writes and reject with reload guidance rather than silently overwrite newer documents — preserves local data at cost of requiring reload after edits in another tab.
Ruling: Updated existing transitive source-map-js to patched 1.2.2 when npm reported an advisory — patch-only build dependency change; npm audit now reports zero vulnerabilities.
Task 4: complete — final `npm test`: 17/17 passing; Playwright Chrome: 12/12 passing (8.8 s); CSS build, JavaScript syntax checks, git diff --check all passed. Desktop/Notepad and 360px calculator screenshots visually inspected. npm audit: zero vulnerabilities after patch update. Changes left uncommitted in codex/basic-desktop; no publish or merge.
