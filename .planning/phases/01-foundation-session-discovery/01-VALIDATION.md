---
phase: 1
slug: foundation-session-discovery
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend) + cargo test (Rust backend) |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `cargo test --lib && npx vitest run --reporter=dot` |
| **Full suite command** | `cargo test && npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cargo test --lib && npx vitest run --reporter=dot`
- **After every plan wave:** Run `cargo test && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-T1 | 01 | 1 | PERF-01 | env check | `rustc --version && cargo --version && node --version` | N/A | ⬜ pending |
| 01-01-T2 | 01 | 1 | PERF-02 | build | `cd workspace-resume/src-tauri && cargo check` | ❌ plan creates | ⬜ pending |
| 01-01-T3 | 01 | 1 | PERF-02 | build | `cd workspace-resume/src-tauri && cargo build` | ❌ plan creates | ⬜ pending |
| 01-02-T1 | 02 | 2 | DISC-02, DISC-03 | unit | `cd workspace-resume/src-tauri && cargo test path_decoder::tests && cargo test scanner::tests` | ❌ plan creates | ⬜ pending |
| 01-02-T2 | 02 | 2 | DISC-01 | build | `cd workspace-resume/src-tauri && cargo build` | ❌ plan creates | ⬜ pending |
| 01-03-T1 | 03 | 3 | DISC-04 | build | `cd workspace-resume/src-tauri && cargo build` | ❌ plan creates | ⬜ pending |
| 01-03-T2 | 03 | 3 | DISC-04, PERF-01 | build + typecheck | `cd workspace-resume/src-tauri && cargo build && cd .. && npx tsc --noEmit` | ❌ plan creates | ⬜ pending |
| 01-03-T3 | 03 | 3 | ALL | manual | human verification of end-to-end pipeline | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Plan 01 Task 1 serves as the de facto Wave 0 — it verifies the Rust toolchain and Node.js are available before any code is created. No separate Wave 0 plan is needed.

- [ ] `rustc --version` — Rust stable >= 1.77.2
- [ ] `cargo --version` — Cargo available
- [ ] `node --version` — Node.js >= 20.0.0
- [ ] `npm --version` — npm available

Test infrastructure (vitest) is installed as part of Plan 01 Task 2 (scaffold). Rust test modules (`path_decoder::tests`, `scanner::tests`) are created in Plan 02 Task 1 (TDD).

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| App starts in <2s | PERF-01 | Timing depends on hardware, cold vs warm start | Launch app 3 times, measure with stopwatch |
| Low idle resource usage | PERF-02 | RAM measurement requires Task Manager observation | Check Task Manager after 30s idle |
| Visibility-gated refresh | DISC-04 | Requires minimizing/restoring app window | Minimize app, trigger file change, restore — verify refresh on restore |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
