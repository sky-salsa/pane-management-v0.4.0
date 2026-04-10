# Pane Management — Portability Audit

**Date:** 2026-04-07
**Purpose:** Identify everything that needs to change before distributing to other Windows 11 users.
**Reference:** See DEPENDENCIES.md for the full prerequisite chain.

---

## Target Audience

- Windows 11 users, varying technical skill
- Some are Claude Code users, some are not
- None have WSL or tmux set up yet
- Goal: "just works" installer + bootstrap script

---

## Audit Summary

| Category | Count | Status |
|----------|-------|--------|
| Blockers | 8 | Must fix before any distribution |
| Warnings | 9 | Should fix for good UX |
| Info | 6 | Nice-to-have, cosmetic |
| Already Portable | 9 | No changes needed |

---

## BLOCKERS

### B-P1: Hardcoded Sky Paths in Orphan Scanner

**Files:** `workspace-resume/src/contexts/AppContext.tsx` lines ~205, ~212
**What:** The F-61 escalating inode search has literal paths:
```typescript
"/mnt/c/Users/USERNAME/Documents/MAIN/AI Workspace/Access Directory"
"/mnt/c/Users/USERNAME/Documents/MAIN"
```
**Impact:** Orphan relocation silently fails for all other users.
**Fix:** Derive search roots from the user's known project paths (parent directories of registered projects), or let users configure scan roots in settings. Remove hardcoded paths entirely.

---

### B-P2: Dev-Only Code Ships in Production

**Files:**
- `workspace-resume/src/lib/tauri-commands.ts` lines 236-239 (`devRestart` export)
- `workspace-resume/src/components/layout/TopBar.tsx` (rebuild button + import)
- `workspace-resume/src-tauri/src/lib.rs` line 24 (`dev_restart` command registration)

**What:** `dev_restart` calls `std::process::exit(0)` and is exposed as a visible button.
**Impact:** End users see a "Rebuild" button that hard-kills the app with no graceful cleanup.
**Fix:** Remove the command, the export, the import, and the button. Or gate behind `#[cfg(debug_assertions)]` on the Rust side and a build-time env flag on the frontend.

---

### B-P3: Hardcoded tmux Session Name "workspace"

**File:** `workspace-resume/src-tauri/src/services/terminal/tmux.rs` lines 61-62
**What:** `let session = "workspace";` — all new tmux sessions get this name.
**Impact:** If user already has a tmux session named "workspace", collision. Also not descriptive.
**Fix:** Let users name their session on first run, or derive from a setting. Default could still be "workspace" but must be configurable.

---

### B-P4: Hardcoded tmux-resurrect Plugin Paths

**File:** `workspace-resume/src-tauri/src/commands/tmux.rs` lines ~354, ~362
**What:**
```rust
"bash ~/.tmux/plugins/tmux-resurrect/scripts/save.sh"
"bash ~/.tmux/plugins/tmux-resurrect/scripts/restore.sh"
```
**Impact:** If tmux-resurrect is not installed (it's optional), these commands fail silently.
**Fix:** Check if the plugin exists before invoking. Make save/restore features conditional. Show "tmux-resurrect not installed" in UI if missing.

---

### B-P5: No First-Run Prerequisite Check

**Files:** Multiple — all WSL/tmux commands assume the environment is ready.
**What:** App calls `wsl.exe` without checking if WSL is installed. Calls tmux without checking if it's available in WSL. Calls `claude` without checking if Claude Code is installed.
**Impact:** On a clean Windows 11 box, the app opens but every action fails silently or with cryptic errors.
**Fix:** Add a startup health check that verifies:
1. WSL installed (`wsl --status`)
2. A Linux distro is present (`wsl -l`)
3. tmux is available (`wsl -e which tmux`)
4. Claude Code is available (`wsl -e which claude`)
Show a "Setup Required" screen with clear instructions for anything missing.

---

### B-P6: Version Mismatch Between Cargo.toml and tauri.conf.json

**Files:**
- `workspace-resume/src-tauri/Cargo.toml` → `version = "0.1.0"`
- `workspace-resume/src-tauri/tauri.conf.json` → `"version": "0.4.0"`

**Impact:** Confusing version reporting. Installer may show wrong version.
**Fix:** Align both to the same version (0.4.0 or whatever is current).

---

### B-P7: Generic App Identifier

**File:** `workspace-resume/src-tauri/tauri.conf.json`
**What:** `"identifier": "com.pane-management.app"` — not uniquely namespaced.
**Impact:** Could collide with other apps using the same generic identifier. Tauri uses this for store paths, window state, etc.
**Fix:** Change to something like `com.skysalsa.pane-management` or similar unique namespace.

---

### B-P8: Placeholder Author in Cargo.toml

**File:** `workspace-resume/src-tauri/Cargo.toml`
**What:** `authors = ["you"]`
**Impact:** Shows in app metadata, installer properties.
**Fix:** Replace with actual name/handle.

---

## WARNINGS

### W-P1: Claude CLI Assumed on PATH

**Files:**
- `workspace-resume/src-tauri/src/commands/launcher.rs` lines ~154-157
- `workspace-resume/src/lib/launch.ts` lines ~132-133, ~168

**What:** Commands like `claude -r`, `claude -r {sessionId}` are hardcoded strings.
**Impact:** If Claude Code isn't installed or is named differently, pane shows "command not found".
**Fix:** Validate `claude` availability in the prerequisite check (B-P5). Optionally make the command configurable in settings.

---

### W-P2: PowerShell Path Escaping Incomplete

**File:** `workspace-resume/src-tauri/src/services/terminal/powershell.rs`
**What:** `format!("Set-Location '{}'; {}", working_dir, command)` — single quotes don't escape PowerShell metacharacters (`$`, backtick, etc.).
**Impact:** Projects with `$` or backticks in path names will fail to launch via PowerShell.
**Fix:** Escape PowerShell special characters in paths, or use `-LiteralPath`.

---

### W-P3: localStorage for Session Renames (Should Use Tauri Store)

**File:** `workspace-resume/src/components/project/ProjectDetailModal.tsx` lines ~38-55
**What:** Custom session names stored in browser localStorage, not Tauri's persistent store.
**Impact:** Data lost on WebView cache clear. Not backed up with other settings.
**Fix:** Move to Tauri store (same as other settings).

---

### W-P4: WSL Mount Prefix Assumed `/mnt/c/`

**File:** `workspace-resume/src/lib/path.ts` lines ~20-28
**What:** `fromWslPath` regex only matches `/mnt/<drive>/` pattern. WSL supports custom mount points via `/etc/wsl.conf`.
**Impact:** Users with non-default WSL mount configs will have broken path conversion.
**Fix:** Query WSL for actual mount prefix, or document that default mount config is required.

---

### W-P5: No Tauri Shell Plugin / No Allowlist

**Files:** `workspace-resume/src-tauri/Cargo.toml`, `capabilities/default.json`
**What:** App uses `std::process::Command` directly for wsl.exe, powershell.exe instead of Tauri's shell plugin with ACL.
**Impact:** Security concern — no allowlist constraining what executables the app can run. Some antivirus software may flag this.
**Fix:** Either add `tauri-plugin-shell` with explicit allowlist, or document this as an intentional design choice and accept AV risk.

---

### W-P6: CSP Disabled

**File:** `workspace-resume/src-tauri/tauri.conf.json` line 39
**What:** `"csp": null` — Content Security Policy is disabled.
**Impact:** If app ever loads external content, XSS is possible. Low risk for local-only app but bad practice.
**Fix:** Set basic CSP: `"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"`

---

### W-P7: Hardcoded Version String in UI

**File:** `workspace-resume/src/components/SettingsPanel.tsx` line ~125
**What:** `<span class="settings-version">v0.4.0</span>` — hardcoded, won't auto-update.
**Fix:** Import version from `package.json` or read from Tauri's app metadata.

---

### W-P8: ~40 console.log Statements

**Files:** App.tsx, launch.ts, AppContext.tsx, and others
**What:** Verbose `[ProjectCard]`, `[F-61]`, `[launchToPane]` debug logging everywhere.
**Impact:** Noisy DevTools console. Not harmful but unprofessional for distribution.
**Fix:** Gate behind a debug flag, or accept as acceptable debug output.

---

### W-P9: No Code Signing

**What:** Installer .msi and .exe files won't be signed.
**Impact:** Windows SmartScreen will show "Unknown publisher" warning. Users may be hesitant to install.
**Fix:** Get a code signing certificate (can be self-signed for friends, or purchase one for wider distribution).

---

## INFORMATIONAL

### I-P1: Test Data Uses Developer Paths
Multiple test files reference `C:\Users\USERNAME\...` paths. Tests still pass (logic is generic) but examples are misleading for contributors. Low priority.

### I-P2: Debug eprintln! Statements in Rust
Stderr logging in tmux.rs, discovery.rs. Harmless but noisy. Consider the `log` crate.

### I-P3: Default Session Name "workspace"
New tmux sessions default to "workspace", "session-2", etc. Functional but not customizable. See B-P3.

### I-P4: Warp Config Path Structure Assumed
`warp.rs` assumes `%APPDATA%/warp/Warp/data/launch_configurations/`. If Warp changes internal structure, this breaks. Warp is optional so low impact.

### I-P5: WSL Availability Check Could Be Cached
`is_available()` runs `wsl --status` subprocess every call. Could cache at startup.

### I-P6: Windows-Only Platform
Intentional for v1. Should be documented in README / system requirements.

---

## ALREADY PORTABLE (No Changes Needed)

1. **Tauri capability scopes** — use `$HOME` variable, not hardcoded paths
2. **Empty state handling** — graceful fallbacks when no projects, no sessions, no panes
3. **Installer configuration** — MSI + NSIS both configured, per-user install mode
4. **App icons** — complete set for all sizes
5. **Settings persistence** — Tauri store (filesystem-backed, portable)
6. **Theme system** — CSS variables, no hardcoded values
7. **Path conversion utilities** — generic `/mnt/<drive>/` ↔ `<DRIVE>:\` logic
8. **Tauri store keys** — project-relative, not user-specific
9. **No external network calls** — everything runs locally

---

## DISTRIBUTION STRATEGY

### Option A: Binary + Setup Guide (Quickest)
- Fix blockers B-P1 through B-P8
- Build .msi installer via `npm run tauri build`
- Write a setup guide (WSL + tmux + Claude Code)
- Hand friends the .msi + guide
- **Effort:** ~1-2 sessions of focused work

### Option B: Bootstrap Script + Installer (Better UX)
- Everything in Option A, plus:
- PowerShell bootstrap script that automates WSL + Ubuntu + tmux + Node + Claude Code
- First-run health check screen in the app
- **Effort:** ~2-3 sessions

### Option C: Full "Just Works" Installer (Best UX, Most Effort)
- Everything in Option B, plus:
- Single installer that bundles the bootstrap
- Handles the WSL reboot requirement gracefully
- Post-reboot auto-continues setup
- Code signing
- **Effort:** ~4-5 sessions

### Recommendation
**Start with Option B.** Fix the blockers, write the bootstrap script, add the health check. This gets you to "hand it to a friend and it works within 30 minutes" territory. Option C is a polish pass you can do later if there's demand.

---

## PRE-RELEASE CHECKLIST

- [ ] Fix B-P1: Remove hardcoded Sky paths from orphan scanner
- [ ] Fix B-P2: Remove dev-only code (devRestart, rebuild button)
- [ ] Fix B-P3: Make tmux session name configurable
- [ ] Fix B-P4: Make tmux-resurrect conditional
- [ ] Fix B-P5: Add first-run prerequisite health check
- [ ] Fix B-P6: Align version numbers
- [ ] Fix B-P7: Set unique app identifier
- [ ] Fix B-P8: Set real author name
- [ ] Fix W-P1: Validate claude CLI availability
- [ ] Fix W-P6: Enable CSP
- [ ] Fix W-P7: Dynamic version string
- [ ] Write bootstrap.ps1 script
- [ ] Write README / setup guide for end users
- [ ] Test on clean Windows 11 VM
- [ ] Build .msi installer
