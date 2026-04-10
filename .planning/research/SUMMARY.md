# Research Summary: Workspace Resume

**Domain:** Desktop session launcher with spatial window management (Windows)
**Researched:** 2026-03-28
**Overall confidence:** HIGH

## Executive Summary

Workspace Resume is a Tauri 2 desktop app that manages Claude Code sessions with per-session window position memory across multi-monitor setups. The core stack is well-established: Tauri 2.10.x (Rust backend + WebView2), SolidJS 1.9.x (frontend), Vite 6.x, TypeScript, and Tailwind CSS 4. All of these are stable, production-ready technologies with official Tauri support.

The architecture splits cleanly into three concerns: (1) session discovery by parsing Claude Code's local JSONL files, (2) terminal spawning with a configurable launcher abstraction, and (3) external window position tracking via Win32 APIs. The first two are straightforward engineering. The third -- tracking positions of windows that Tauri doesn't own, across multiple monitors with different DPI scaling, surviving crashes -- is the project's technical core and its primary risk.

The competitive landscape is favorable. Numerous Claude Code session browsers exist (claudecodeui, ccrider, claude-session-browser) but none combine session awareness with per-session window position memory. PowerToys Workspaces and PersistentWindows handle generic window positioning but have no concept of Claude Code sessions. This product sits in an unclaimed niche.

The biggest risk is not the stack (it's mature) but the domain complexity of robust window position tracking on Windows. Multi-monitor DPI handling, crash resilience, monitor disconnect/reconnect, and the undocumented Claude Code session file format are the primary pitfalls. These are well-characterized and have known mitigations, but they demand careful phasing -- getting position tracking right requires designing for DPI and crash recovery from the initial implementation, not as afterthoughts.

## Key Findings

**Stack:** Tauri 2.10.x + SolidJS 1.9.x + Vite 6.x + TypeScript + Tailwind CSS 4. Microsoft `windows` crate (0.62.x) for Win32 window tracking. All stable, all verified.

**Architecture:** Three-service backend (Session Discovery, Terminal Launcher, Window Tracker) communicating with a SolidJS frontend via typed IPC. Win32 APIs handle external window management that Tauri can't do natively.

**Critical pitfall:** Window position tracking is deceptively complex. Four interlocking pitfalls (crash persistence, DPI scaling, monitor disconnect, minimized window coordinates) must all be addressed in the initial implementation. Retrofitting any of them is a rewrite.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Foundation + Session Discovery** - Scaffold Tauri app, implement Claude Code JSONL parsing, build project discovery
   - Addresses: Table stakes features 1-3, 8 (discovery, session list, manual add)
   - Avoids: Pitfall 2 (undocumented format) by implementing defensive parsing from day one
   - Avoids: Pitfall 8 (WebView2 issues) by testing on clean Windows early

2. **Dashboard + Terminal Launching** - Build the card-based dashboard and terminal spawning with configurable launcher
   - Addresses: Table stakes features 4-7, 9-10 (dashboard, cards, resume, pin/unpin, terminal abstraction)
   - Avoids: Pitfall 4 (GUI subsystem console spawning) by using raw `std::process::Command` with `CREATE_NEW_CONSOLE`
   - Avoids: Pitfall 6 (Warp CLI limitations) by implementing Windows Terminal as the reliable first backend

3. **Window Position Tracking** - The differentiator: per-session window positions with crash resilience and multi-monitor support
   - Addresses: Differentiators D1-D3 (position memory, crash resilience, multi-monitor)
   - Must address: Pitfalls 1, 3, 5, 7 together (crash persistence, DPI, monitor disconnect, minimized windows)
   - This phase needs the most careful implementation

4. **Spatial Canvas + Polish** - Upgrade dashboard to free-arrange canvas, add display names, global hotkey, system tray
   - Addresses: Differentiators D4-D6 (free canvas, display names, global hotkey)
   - Lower risk -- standard web UI work

**Phase ordering rationale:**
- Phase 1 must come first because all other phases depend on session data
- Phase 2 depends on Phase 1 (you need projects to display on the dashboard, sessions to resume)
- Phase 3 depends on Phase 2 (you need spawned terminal windows to track)
- Phase 4 is independent of Phase 3 and could be interleaved, but polishing the dashboard after core features work reduces rework

**Research flags for phases:**
- Phase 1: Likely needs brief research spike on Claude Code JSONL schema (map field names, handle edge cases)
- Phase 2: May need Warp CLI investigation if user wants Warp before Windows Terminal
- Phase 3: Likely needs deeper research on Win32 DPI-aware window positioning patterns
- Phase 4: Standard patterns, unlikely to need research

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against official sources. Tauri 2.10.x, SolidJS 1.9.x, Vite 6.x are stable and well-documented. |
| Features | MEDIUM-HIGH | Table stakes and differentiators well-characterized via competitive analysis. Feature dependencies are clear. |
| Architecture | HIGH | Three-service backend pattern is standard Tauri architecture. Win32 API approach for external windows is the only viable path (verified: Tauri cannot manage non-webview windows). |
| Pitfalls | HIGH | 11 pitfalls documented with sources. Critical ones (position tracking, session format) have known mitigations. |
| Session format | MEDIUM | JSONL structure is reverse-engineered from community projects, not officially documented. Format may change. |
| Warp CLI | LOW | Warp's Windows CLI is immature and poorly documented. Windows Terminal is the safer first target. |

## Gaps to Address

- **Claude Code JSONL schema mapping**: Need to parse real session files to map exact field names, message types, and edge cases. Community documentation exists but may be stale.
- **Warp Windows CLI maturity**: As of March 2026, Warp on Windows lacks CLI flags for directory/command specification. This may improve -- check before implementing Warp launcher backend.
- **Win32 DPI-aware positioning cookbook**: The theory is well-documented but finding production Rust code that handles all the edge cases (DPI change mid-session, monitor reorder, mixed scaling) may require a research spike during Phase 3.
- **Vite 6 vs Vite 7 decision**: Vite 6 is the safe recommendation (official `vite-plugin-solid` support). Vite 7 is viable but check plugin compatibility before upgrading. Vite 8 is too new.
- **SolidJS 2.0 timeline**: Solid 2.0 is in experimental development. No urgency to plan for migration -- Solid 1.9.x is stable and will be supported through the 2.0 transition.
