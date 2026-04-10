# Phase 4: Distribution Prep

**Goal:** Make Pane Management portable, installable, updatable, and supportable for other Windows 11 users.
**Target audience:** Friends running Windows 11 with varying technical skill. No WSL, no tmux, no Claude Code yet.
**Approach:** Option B+ from PORTABILITY-AUDIT.md — fix blockers, add infrastructure (logging, telemetry, updater, testing), bootstrap script, installer.
**Reference:**
- `/PORTABILITY-AUDIT.md` — full portability audit with line numbers and severity ratings
- gstack reference implementation for telemetry patterns (3-tier opt-in, local JSONL, pending crash markers)

---

## Session Plan (5 sessions)

### Session 1: Fix Portability Blockers (04-01)
**Goal:** Remove all hardcoded paths, dev-only code, and metadata issues so the codebase is clean for any user.

Tasks:
1. **B-P1:** Remove hardcoded Sky paths from orphan scanner (AppContext.tsx ~205, ~212)
   - Replace with dynamic derivation from registered project parent directories
2. **B-P2:** Remove dev-only code
   - Delete `devRestart` from tauri-commands.ts, TopBar.tsx import + button, lib.rs registration
   - Or gate behind `#[cfg(debug_assertions)]` + build-time env flag
3. **B-P3:** Make tmux session name configurable
   - Add setting in Tauri store, default "workspace", read in tmux.rs
4. **B-P4:** Make tmux-resurrect conditional
   - Check if plugin exists before invoking save/restore scripts
   - Graceful fallback with UI indication
5. **B-P6:** Align version numbers (Cargo.toml + tauri.conf.json)
6. **B-P7:** Set unique app identifier (e.g., `com.skysalsa.pane-management`)
7. **B-P8:** Set real author in Cargo.toml
8. **W-P6:** Enable CSP in tauri.conf.json
9. **W-P7:** Dynamic version string in SettingsPanel

**Verification:** `cargo build` succeeds, no grep hits for hardcoded Sky paths, dev button gone.

---

### Session 2: Logging, Telemetry + Updater Infrastructure (04-02)
**Goal:** Three observability layers — debug logging (crash diagnosis), usage telemetry (understand how the app is used), and auto-update (push fixes to installed copies).

**Design philosophy (borrowed from gstack):**
- Telemetry is OFF by default. Explicit opt-in with clear consent.
- Local-first: everything writes to local files before any remote sync.
- Never collect: project paths, session content, Claude API keys, repo names.
- Never block the UI on telemetry writes — all fire-and-forget.

Tasks:

#### Layer 1: Debug Logging (`tauri-plugin-log`)
1. Add `tauri-plugin-log` to Cargo.toml + `@tauri-apps/plugin-log` to npm
2. Configure `LogTarget::LogDir` — writes to `%APPDATA%/Pane Management/logs/`
3. Replace `eprintln!` debug statements in Rust with `log::info!` / `log::warn!` / `log::error!`
4. Replace frontend `console.log("[tag]")` calls with plugin's `info()` / `warn()` / `error()`
5. Add `panic::set_hook` for crash backtrace capture to log file
6. Add log rotation config (keep last N files, max size per file)
7. Add "Open Log Folder" button in Settings panel

#### Layer 2: Usage Telemetry (local JSONL, gstack-inspired)
8. Create telemetry module (Rust side) with 3-tier opt-in: `off | anonymous | community`
   - Setting stored in Tauri store, default `off`
   - `anonymous`: no install ID, just event data
   - `community`: includes `installation_id` (UUID v4, generated on first opt-in)
9. Define event schema (v1):
   ```
   {
     "v": 1,
     "ts": "ISO-8601",
     "event_type": "session_launch | session_resume | pane_assign | health_check | app_start | app_crash",
     "app_version": "0.5.0",
     "os": "windows",
     "duration_s": 12.3,       // for timed events
     "outcome": "success | error | unknown",
     "error_class": "wsl_not_found",  // on failure
     "installation_id": null,  // only for community tier
     "session_id": "uuid"      // groups events within one app session
   }
   ```
   **Never collected:** project paths, project names, session content, Claude API keys, tmux pane content
10. Write events to `%APPDATA%/Pane Management/telemetry/events.jsonl` (append-only)
11. **Pending crash markers** (gstack pattern):
    - On app start: write `.pending` marker file with timestamp + session_id
    - On clean shutdown: delete marker
    - On next start: if stale marker exists, log `app_crash` event with `outcome: unknown`
    - This catches hard crashes, force-kills, blue screens — anything that skips cleanup
12. Sanitize all string fields before writing (strip quotes, truncate, prevent JSON injection)
13. Add telemetry tier picker to Settings panel with clear explanation of each tier
14. Add "What do we collect?" expandable section in Settings (transparency)

#### Layer 3: Auto-Updater (`tauri-plugin-updater`)
15. Add `tauri-plugin-updater` to Cargo.toml + `@tauri-apps/plugin-updater` to npm
16. Generate Tauri signing keypair (`npx tauri signer generate`)
17. Configure updater endpoint in `tauri.conf.json` pointing to GitHub Releases `latest.json`
18. Frontend: check for updates on app launch, show "Update available" banner with install button
19. Set up GitHub Actions workflow (`.github/workflows/release.yml`):
    - Triggered on version tag push (e.g., `v0.5.0`)
    - Builds .msi + .nsis installers
    - Generates `latest.json` manifest with signature
    - Uploads to GitHub Release
20. Store signing private key + password as GitHub Actions secrets

**Verification:**
- Debug logs written to `%APPDATA%/Pane Management/logs/`. "Open Log Folder" works.
- Telemetry defaults to off. Switching to anonymous writes events to `events.jsonl`.
- Kill app via Task Manager → restart → stale marker detected, crash event logged.
- Updater check runs on launch without errors (even if no update available).
- GitHub Action builds successfully on tag push.

---

### Session 3: First-Run Experience + Bootstrap Script (04-03)
**Goal:** New users see helpful guidance instead of silent failures. Bootstrap script automates prereq setup.

Tasks:
1. **B-P5:** First-run prerequisite health check
   - Rust command: check WSL (`wsl --status`), distro (`wsl -l`), tmux (`wsl -e which tmux`), claude (`wsl -e which claude`)
   - Return structured health report to frontend
   - Frontend: "Setup Required" screen when prerequisites missing, with per-item status and instructions
   - "Re-check" button to re-run health check after user installs something
   - Link to bootstrap script download / instructions
2. **Bootstrap script** (`bootstrap.ps1`)
   - Phase 1: Check/install WSL2 (`wsl --install`), warn about reboot
   - Phase 2 (post-reboot): Install Ubuntu, apt install tmux, install nvm + node + claude code
   - Clear console output at each step with progress indicators
   - Idempotent — safe to re-run if interrupted or after partial install
   - Exit with summary of what was installed and what the user should do next
3. **W-P1:** Validate claude CLI availability (integrate with health check)
4. **W-P3:** Move localStorage session renames to Tauri store (cleanup while in the area)

**Verification:** App shows health check screen on simulated missing prereqs. Bootstrap script runs without errors on a system that already has everything (idempotent test). "Re-check" button clears the setup screen when prereqs are satisfied.

---

### Session 4: Testing Infrastructure + Feedback (04-04)
**Goal:** Automated checks that prevent portability regressions, verify the app works, and give users a way to report issues with rich context.

Tasks:

#### Portability Guards
1. **Portability regression script** (`scripts/check-portability.ps1` or `.sh`)
   - Grep for hardcoded usernames/paths (Sky, /mnt/c/Users/USERNAME, etc.)
   - Verify version numbers match across Cargo.toml, tauri.conf.json, package.json
   - Verify dev-only code is gated or removed (search for "DEV-ONLY", "dev_restart")
   - Verify app identifier is not generic placeholder
   - Run as pre-commit hook or CI step
2. **Smoke test script** (`scripts/smoke-test.ps1`)
   - Launch the built .msi app
   - Verify window appears (process check)
   - Verify health check screen shows (for clean environment) or main UI shows (for configured environment)
   - Verify log file is created in expected location
   - Verify updater check doesn't crash
   - Exit with pass/fail summary

#### CI Integration
3. Add portability check to GitHub Actions (runs on every PR)
4. Smoke test runs after build in release workflow

#### User Feedback Mechanism
5. **"Send Feedback" button** in Settings:
   - Collects last N log entries from `%APPDATA%/Pane Management/logs/`
   - Collects system info: Windows version, WSL status, WSL distro, tmux version, Claude Code version, app version
   - Collects health check results (what passed, what failed)
   - Collects recent telemetry events (last 20, only if telemetry is enabled)
   - Formats as structured Markdown text
   - Copies to clipboard (user pastes into Discord/email/GitHub issue)
   - No server needed — clipboard is the transport
6. **Local analytics view** (gstack-inspired, optional stretch):
   - Read `events.jsonl` and display summary in Settings or a new "Stats" tab:
     - Total sessions launched, total app starts
     - Most-used projects (by launch count, not by name — just "Project A", "Project B" since we don't collect names)
     - Crash count in last 7d / 30d
     - Uptime / usage duration
   - Purely local, purely optional, just for the user's own interest

**Verification:** Portability script catches a deliberately introduced hardcoded path. Smoke test passes on the build output. Feedback button produces useful clipboard payload with system info + logs.

---

### Session 5: Build, Test, Package (04-05)
**Goal:** Produce the final distributable, test end-to-end, write user-facing docs.

Tasks:
1. Build .msi installer via `npm run tauri build`
2. Full end-to-end test:
   - Install on a non-dev machine (or clean user profile)
   - Run bootstrap.ps1 if prereqs missing
   - Launch app, verify health check passes
   - Create a tmux session, verify pane management works
   - Check that updater runs (even if no update available)
   - Verify logs are written to correct location
   - Verify telemetry is off by default, events.jsonl doesn't exist until opt-in
   - Kill app, restart, verify crash marker detection works
   - Use feedback button to generate a report
3. Write README for end users
   - System requirements
   - Install flow (bootstrap.ps1 → .msi → launch)
   - What to expect on first run (health check screen)
   - How to share logs / report bugs (feedback button)
   - Privacy: what telemetry collects and doesn't collect
   - SmartScreen warning explanation (unsigned binary)
   - Troubleshooting common issues
4. Update DEPENDENCIES.md Quick Start to reference bootstrap.ps1
5. **W-P9:** Document SmartScreen warning for unsigned builds (code signing cert is optional for friends-only distribution)
6. Tag first release version, push to trigger GitHub Actions build
7. Package deliverable: GitHub Release with .msi + bootstrap.ps1 + README

**Verification:** A non-developer can follow the README from scratch and end up with a working app. GitHub Release page has all artifacts. Update check points to the release. Telemetry is off by default. Feedback button works.

---

## Data Collection Boundaries

Explicit contract for what Pane Management telemetry does and does not collect.
This should be displayed in the app (Settings → "What do we collect?") and in the README.

### Collected (when opted in)
| Field | Purpose | Example |
|-------|---------|---------|
| Event type | What action occurred | `session_launch`, `app_start` |
| App version | Track which versions crash | `0.5.0` |
| OS | Platform stats | `windows` |
| Duration | Performance tracking | `12.3s` |
| Outcome | Success/failure rates | `success`, `error` |
| Error class | Categorize failures | `wsl_not_found` |
| Installation ID | Retention tracking (community tier only) | `uuid-v4` |

### Never Collected
| Data | Why not |
|------|---------|
| Project paths | Contains usernames and directory structure |
| Project names | Personal/work context |
| Session content | Claude conversation data |
| Claude API keys | Credentials |
| Tmux pane content | Could contain anything |
| File contents | Privacy |
| IP addresses | Not needed, not logged |

---

## Warnings to Address Opportunistically

These aren't session-planned but should be fixed when touching nearby code:
- W-P2: PowerShell path escaping (fix if editing powershell.rs)
- W-P4: WSL mount prefix assumption (fix if editing path.ts)
- W-P5: Shell plugin / allowlist (assess during Session 3 health check work)

---

## Dependency Graph

```
Session 1 (blockers) ─────→ Session 2 (logging + telemetry + updater) ─→ Session 5 (package)
                       ├───→ Session 3 (first-run + bootstrap) ──────────→ Session 5
                       └───→ Session 4 (testing + feedback) ─────────────→ Session 5
```

Sessions 2, 3, and 4 can run in any order after Session 1.
Session 5 depends on all of 2, 3, and 4 being complete.

---

## Reference Implementations

| Pattern | Source | Location |
|---------|--------|----------|
| 3-tier telemetry opt-in | gstack | `scripts/analytics.ts`, `test/telemetry.test.ts` |
| Local JSONL event logging | gstack | `~/.gstack/analytics/skill-usage.jsonl` |
| Pending crash markers | gstack | Telemetry module — `.pending-{SESSION_ID}` pattern |
| JSON injection prevention | gstack | `test/telemetry.test.ts` — 8 test cases |
| Event schema with "never collect" list | gstack | Telemetry docs |
| Supabase edge function ingest | gstack | `supabase/functions/telemetry-ingest/index.ts` (future reference if we outgrow local-only) |
| Community pulse dashboard | gstack | `supabase/functions/community-pulse/index.ts` (future reference) |
