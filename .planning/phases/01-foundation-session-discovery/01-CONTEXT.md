# Phase 1 Context: Foundation + Session Discovery

**Phase goal:** Scaffold the Tauri app and build the engine that discovers all Claude Code projects and parses their session data from local files.

**Requirements:** DISC-01, DISC-02, DISC-03, DISC-04, PERF-01, PERF-02

## Locked Decisions

Decisions made during discussion. Downstream agents (researcher, planner) should treat these as constraints, not suggestions.

### Data Freshness

- **File watcher is preferred** for detecting new sessions/projects. Polling is an acceptable fallback. Manual-only refresh is unacceptable.
- **Light background monitoring**: File watcher runs always, but UI only refreshes when the dashboard is visible. Zero wasted rendering when minimized.
- **Session metadata refresh**: Claude's discretion — pick whatever balances freshness vs I/O for the parsing approach chosen.

### Stale Project Handling

- **Missing folders prompt the user**: When a discovered project's directory no longer exists on disk, show a notification asking the user to remove or re-link the project. Don't silently hide it, don't leave it broken.
- **Corrupted sessions shown with warning**: If a session file is unreadable or corrupted, still show the session entry but mark it with a visual warning indicator. Don't silently skip it.

### Initial App Shell (Phase 1 UI)

- **Dev-only view**: Phase 1 builds a raw data dump / debug panel to verify the discovery pipeline works. This UI is throwaway — it gets replaced by the real dashboard in Phase 3.
- **App chrome**: Claude's discretion. Use whatever makes sense — default Tauri chrome is fine, custom title bar is fine. The investment here should be minimal since Phase 3 replaces it.

### Session Data Depth

- **Requirements only**: Parse timestamps and the user's last input message from each session. Nothing more for Phase 1 — no model info, token counts, or message history. Keep the parser lean.
- **Caching strategy**: Claude's discretion. Pick whatever delivers good performance for a user with 20+ projects and many sessions. Both cache-with-invalidation and parse-on-demand are acceptable.

## Deferred Ideas

Ideas that came up but belong in later phases or v2. Captured here so they don't get lost.

- Extract richer session metadata (model, token counts, duration) — future enhancement, not Phase 1
- Custom app chrome / branding — Phase 3 Dashboard Canvas is the right place

## Open Questions for Research

Questions the researcher agent should investigate during `/gsd:plan-phase 1`:

1. **Claude Code session file format**: What is the exact JSONL structure? How are project paths encoded in `~/.claude/projects/`? How to extract the user's last input message from the JSONL stream?
2. **Tauri file watcher**: Does Tauri have a first-party file watcher plugin, or should we use `notify` crate directly? What's the recommended pattern for watching a directory tree?
3. **Stream-based JSONL parsing**: For large session files (multi-GB), what's the best Rust approach to read just the last N lines without loading the whole file? (We only need the last user message.)
4. **Project path decoding**: How does Claude Code encode project paths in the `~/.claude/projects/` directory structure? Is it URL encoding, base64, or something else?

## Phase Boundaries

**This phase includes:**
- Tauri app scaffold with build pipeline
- Session file discovery and parsing engine
- Project path resolution
- File watcher for new session/project detection
- Dev-only UI for verifying discovery works
- Performance baseline (startup time, idle resource usage)

**This phase does NOT include:**
- Project cards, dashboard layout, or canvas (Phase 3)
- Terminal spawning or session resume (Phase 2)
- Window position tracking (Phase 4)
- Global hotkey (Phase 5)
- Any user-facing UI beyond the dev/debug view

---
*Created: 2026-03-29 after Phase 1 discussion*
