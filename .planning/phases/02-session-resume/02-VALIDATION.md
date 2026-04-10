---
phase: 2
slug: session-resume
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | cargo test (Rust backend) + vitest (frontend) |
| **Config file** | Existing from Phase 1 |
| **Quick run command** | `cd workspace-resume/src-tauri && cargo test --lib` |
| **Full suite command** | `cd workspace-resume/src-tauri && cargo test && cd .. && npx tsc --noEmit` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd workspace-resume/src-tauri && cargo test --lib`
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | 01 | 1 | RESU-04 | unit | `cargo test terminal_launcher` | plan creates | ⬜ pending |
| TBD | 01 | 1 | RESU-01, RESU-03 | integration | `cargo test resume_session` | plan creates | ⬜ pending |
| TBD | 02 | 2 | SESS-01, SESS-02, SESS-03, SESS-04 | build + typecheck | `cargo build && npx tsc --noEmit` | plan creates | ⬜ pending |
| TBD | 02 | 2 | RESU-01, RESU-02 | manual | human verification of terminal launch | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Phase 1 infrastructure carries forward. No new test framework setup needed.

- [x] `cargo test` — available from Phase 1
- [x] `npx tsc --noEmit` — available from Phase 1

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Warp terminal opens at project dir | RESU-01, RESU-03 | Requires visual verification of terminal window | Click Resume, verify Warp opens at correct directory |
| Session resumed via claude -r | RESU-01, RESU-02 | Requires Claude Code active session | Resume a session, verify Claude picks up where it left off |
| PowerShell fallback works | RESU-04 | Requires temporarily hiding Warp | Rename warp binary, click Resume, verify PowerShell opens |
| Active session indicator | RESU-01 | Requires visual UI check | Resume session, verify green dot appears |
| Error toast on failed launch | RESU-04 | Requires intentional failure | Point terminal to nonexistent binary, verify toast |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
