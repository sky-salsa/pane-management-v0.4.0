# Terminal Layer Pivot: Warp → tmux (WSL)

**Date:** 2026-03-31
**Status:** RESOLVED — tmux/WSL approach is working

## What happened

- Warp was the specified terminal from project inception
- Phase 2 research found: `warp.exe` is both the Oz cloud CLI and terminal GUI
- Warp's `warp://` URI scheme silently fails on Windows (no visible window)
- Warp has zero CLI flags for working directory or initial command
- YAML launch configs write successfully but can't be triggered programmatically
- Direct `warp.exe` launch opens the GUI but with no directory/command control

## The pivot

User migrated to WSL + tmux as primary Claude Code environment. Warp remains the terminal emulator (viewport for tmux), but we don't need to control Warp — we talk to tmux via `wsl.exe`.

## Working architecture

```
Tauri app (Windows)
  → wsl.exe -e bash -c "tmux commands..."
    → tmux server (WSL, single instance)
      → new window in 'workspace' session
        → cd /mnt/c/... && claude -r <session_id>
```

**3-step launch pattern (avoids all escaping issues):**
1. Find attached session or create 'workspace'
2. `tmux new-window -t workspace: -n <project-name>`
3. `tmux send-keys -t workspace:<name> 'cd "..." && claude -r <id>' Enter`

## Session migration

Windows Claude sessions stored under `C--Users-USERNAME-...` encoding.
WSL Claude sessions stored under `-mnt-c-Users-USERNAME-...` encoding.
Same physical `.claude/projects/` directory, different folder names.

**Fix:** Copied all `C--` folders to `-mnt-c-` equivalents so Claude in WSL can find sessions by ID.

## What changes for Phase 3+

### Phase 3 (Dashboard Canvas) — scope changes:
- **Pane allocation** is the new spatial feature (replaces Win32 window positioning)
  - User allocates Claude sessions to specific tmux panes
  - "Zone presets" = configurable tmux layouts (2-pane, 4-pane, 6-pane)
  - App creates the layout, user assigns sessions to zones
- **Free-arrange canvas** still applies to the dashboard card layout in the Tauri UI
- **Path translation** (Windows → WSL) is already built into TmuxLauncher

### Phase 4 (Window Position Tracking) — fundamentally changes:
- Win32 window position tracking is **no longer needed**
- tmux manages its own layouts natively
- "Position memory" becomes "tmux layout memory" — save/restore named layouts
- This phase may be much simpler or merge into Phase 3

### Phase 5 (Power User Polish) — unchanged:
- Global hotkey still relevant
- Settings UI still relevant

## Deferred ideas captured during Phase 2

- Relative timestamps ("2 hours ago") on sessions — Phase 3
- Project-level "last active" indicator — Phase 3
- Active session count in dashboard header — Phase 3
- Zone preset layouts (configurable pane positions) — Phase 3/4
- Session rename — v2
- Warp-specific features if their CLI matures — future

## Key technical decisions

| Decision | Why |
|----------|-----|
| tmux over Warp CLI | Warp has no programmatic control on Windows |
| Dedicated 'workspace' session | Isolates app-launched windows from manual tmux work |
| 3-step launch (new-window + send-keys) | Avoids shell escaping with spaced paths |
| Windows→WSL path translation in Rust | `/mnt/c/` prefix conversion handles all discovered paths |
| Session folder migration (C-- → -mnt-c-) | One-time fix so WSL Claude finds Windows-created sessions |
| Warp stays as viewport | User needs Wispr voice input which Warp supports |
