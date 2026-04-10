# Domain Pitfalls

**Domain:** Tauri desktop app for Claude Code session management (Windows)
**Researched:** 2026-03-28

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or major architectural issues.

### Pitfall 1: Window Position Saved Only on Graceful Close

**What goes wrong:** The Tauri `window-state` plugin saves window positions when the app closes normally. If the app crashes, the user force-quits, or the system shuts down unexpectedly, position data is lost. Since this project's core value proposition is "spatial memory that survives crashes," relying solely on close-event persistence defeats the purpose.

**Why it happens:** The plugin's default behavior hooks into the close lifecycle. It has no built-in periodic autosave. Developers assume "save on close" covers their needs and don't implement supplementary persistence.

**Consequences:** Users position terminal windows across monitors, the app or system crashes, and every window reopens at default positions. Trust in spatial memory is destroyed after a single failure.

**Prevention:**
- Do NOT rely solely on `tauri-plugin-window-state` for position persistence
- Implement a custom position tracking layer: poll window positions on a timer (every 3-5 seconds) and also on `WM_MOVE`/`WM_SIZE` events via Tauri's window event listeners
- Persist positions to a local store (`tauri-plugin-store` or a simple JSON file) on every meaningful change, debounced to avoid disk thrash
- The plugin's `save_window_state()` can be called manually -- use it as a supplementary save, not the primary one

**Detection:** Test by opening the app, positioning windows, then killing the process via Task Manager. If positions are lost, the crash-survival persistence is broken.

**Phase:** Must be addressed in the very first phase that implements window position tracking. Retrofitting crash-safe persistence onto a close-only system is painful.

**Confidence:** HIGH -- documented plugin limitation confirmed via official Tauri docs and multiple GitHub issues.

**Sources:**
- [Tauri Window State Plugin docs](https://v2.tauri.app/plugin/window-state/)
- [Window state plugin buggy - GitHub #3289](https://github.com/tauri-apps/plugins-workspace/issues/3289)

---

### Pitfall 2: Claude Code Session File Format Is Undocumented and Unstable

**What goes wrong:** The Claude Code JSONL session format and the `sessions-index.json` metadata file have no official stable API. The format has changed between versions, the index file stops being updated in some versions, and concurrent writes can corrupt session files. Building a parser against today's format means it may break silently on the next Claude Code update.

**Why it happens:** Claude Code session storage is an internal implementation detail, not a public API. Anthropic treats it as an internal concern and can change it at will. Third-party tools (claudecodeui, claude-JSONL-browser, claude-session-viewer) all reverse-engineer the format independently and have all experienced breakage.

**Consequences:**
- App silently shows stale/incorrect session lists after a Claude Code update
- Parser crashes on unexpected JSONL line types or missing fields
- `sessions-index.json` may not exist, may be stale, or may stop being updated (documented bug as of early 2026)
- Session files can grow to multi-GB sizes (documented: 3.8 GB), causing memory issues if naively loaded

**Prevention:**
- Parse JSONL defensively: skip unknown line types, handle missing fields gracefully, never assume schema stability
- Do NOT load entire JSONL files into memory -- stream-parse and extract only the metadata you need (sessionId, timestamps, first user message)
- Treat `sessions-index.json` as a useful cache but always fall back to scanning `.jsonl` files directly when the index is missing or stale
- Set hard file-size limits: skip or warn on JSONL files over a threshold (e.g., 50 MB)
- Pin your parser to known fields and add integration tests that run against real session files -- these will be your early warning system when the format changes
- Abstract session reading behind a clean interface so the parser can be swapped without touching the rest of the app

**Detection:** Automated tests that parse a set of real session files. When Claude Code updates, run the tests. Failures indicate format drift.

**Phase:** Must be addressed in the first phase that reads session data. This is foundational -- everything downstream (project discovery, session lists, resume commands) depends on reliable parsing.

**Confidence:** HIGH -- multiple GitHub issues document format instability, index breakage, and corruption.

**Sources:**
- [Sessions index stops updating - GitHub #26485](https://github.com/anthropics/claude-code/issues/26485)
- [sessions-index.json not created - GitHub #18897](https://github.com/anthropics/claude-code/issues/18897)
- [Large JSONL files cause RAM exhaustion - GitHub #22365](https://github.com/anthropics/claude-code/issues/22365)
- [Cross-session contamination - GitHub #26964](https://github.com/anthropics/claude-code/issues/26964)
- [Corrupted JSONL from concurrent writes - GitHub #20992](https://github.com/anthropics/claude-code/issues/20992)
- [Inside Claude Code Session File Format (Medium)](https://databunny.medium.com/inside-claude-code-the-session-file-format-and-how-to-inspect-it-b9998e66d56b)

---

### Pitfall 3: Multi-Monitor DPI Scaling Breaks Position Tracking

**What goes wrong:** When monitors have different DPI scaling factors (e.g., a 4K laptop at 150% and an external monitor at 100%), saved window coordinates become meaningless. A window saved at logical position (2560, 100) on a 150%-scaled monitor maps to a completely different physical location if the scaling changes or the monitor arrangement shifts. Windows drag-between-monitors causes Tauri windows to resize unexpectedly.

**Why it happens:** Windows uses logical coordinates for window positioning, and the translation between logical and physical coordinates depends on the DPI context of the monitor where the window lives. Tauri/WebView2 uses per-monitor DPI awareness (PerMonitorV2), which means coordinate systems shift as windows cross monitor boundaries. Most developers test on single-monitor or same-DPI setups and never encounter the issue.

**Consequences:**
- Windows restore to wrong positions after DPI changes
- Windows "drift" or "jump" when restored to a monitor with different scaling
- Dragging windows between monitors with different DPI causes unexpected resizing (documented Tauri bug)
- Position data becomes invalid if the user changes their display scaling in Windows Settings

**Prevention:**
- Store positions as physical pixels plus the monitor identifier (device name/ID) and the monitor's DPI at save time
- On restore, check if the target monitor's DPI matches the saved DPI. If not, recalculate the logical position
- Always validate that saved coordinates fall within the current display bounds before restoring (handles monitor removal gracefully too)
- Handle the `scale-change` event from Tauri to update stored positions in real-time
- Test with mixed-DPI setups from the very beginning -- not as a polish step

**Detection:** Set up two monitors with different DPI scaling. Save a window position on the high-DPI monitor, close and reopen. If the window appears offset or on the wrong monitor, DPI handling is broken.

**Phase:** Must be designed into the position tracking system from the start. Bolting DPI awareness onto a coordinate system that assumed uniform scaling requires rewriting the persistence format.

**Confidence:** HIGH -- documented Tauri bugs and well-known Windows platform behavior.

**Sources:**
- [Tauri bug: Window size increases across different DPI monitors - GitHub #3610](https://github.com/tauri-apps/tauri/issues/3610)
- [Tauri bug: Awkward dragging between different DPI monitors - GitHub #12043](https://github.com/tauri-apps/tauri/issues/12043)
- [High DPI Desktop App Development - Microsoft Learn](https://learn.microsoft.com/en-us/windows/win32/hidpi/high-dpi-desktop-application-development-on-windows)
- [DisplayFusion: Position save fails on mixed scaling](https://www.displayfusion.com/Discussions/View/window-position-save-fails-on-mixed-scaling-setup/?ID=02e884ec-8500-4019-8504-7e738731db4f)

---

### Pitfall 4: Windows Subsystem GUI App Cannot Properly Spawn Console Processes

**What goes wrong:** Tauri apps on Windows compile with `#![windows_subsystem = "windows"]` in release mode, which means the process has no console. When this GUI process spawns a child console process (like a terminal emulator), the child inherits invalid stdio handles (INVALID_HANDLE_VALUE). This can cause the child to fail silently, display no output, or crash. Additionally, Tauri's sidecar mechanism explicitly hides console windows -- the opposite of what this project needs.

**Why it happens:** Windows GUI subsystem processes don't allocate a console. Rust's `std::process::Command` sets `STARTF_USESTDHANDLES` unconditionally and passes the parent's stdio handles, which are invalid for a GUI app. The child process gets invalid handles and can't write to stdout/stderr.

**Consequences:**
- Spawned terminal windows may not appear at all
- Terminal processes may silently fail to launch
- Using Tauri's built-in `Command` or sidecar API will hide console windows by default -- you need to fight the framework
- Orphaned terminal processes if the Tauri app crashes (no automatic cleanup on Windows)

**Prevention:**
- Do NOT use Tauri's sidecar mechanism for terminal spawning -- it's designed for headless background processes, not visible terminal windows
- Use Rust's `std::process::Command` directly with Windows-specific `creation_flags`:
  - `CREATE_NEW_CONSOLE` (0x00000010) to give the child its own console
  - OR launch the terminal emulator executable directly (e.g., `warp.exe`) rather than a console command
- Use the `std::os::windows::process::CommandExt` trait for `creation_flags()`
- For process cleanup: use Windows Job Objects to associate spawned processes with your app, so they terminate when the app exits
- Track all spawned process IDs for manual cleanup on app exit

**Detection:** Build a release binary (not dev, which still has a console). Attempt to spawn a terminal. If no window appears, this pitfall has bitten you.

**Phase:** Must be solved in the phase that implements terminal launching. Getting this wrong means the core "resume session" action is broken.

**Confidence:** HIGH -- documented Rust issue, Tauri GitHub discussions, and Windows API behavior.

**Sources:**
- [Rust issue: Parent windows subsystem can't create console child - GitHub #101645](https://github.com/rust-lang/rust/issues/101645)
- [CommandExt::creation_flags - Rust docs](https://doc.rust-lang.org/std/os/windows/process/trait.CommandExt.html)
- [Tauri sidecar console window not showing - GitHub #5104](https://github.com/tauri-apps/tauri/issues/5104)
- [Tauri spawned children can't be killed on Windows - GitHub #4949](https://github.com/tauri-apps/tauri/issues/4949)

---

## Moderate Pitfalls

### Pitfall 5: Monitor Disconnect/Reconnect Scrambles Window Positions

**What goes wrong:** When a monitor is disconnected (sleep, undock, DisplayPort power-off), Windows collapses all windows onto the remaining monitor. When the monitor reconnects, Windows does NOT automatically restore windows to their original positions. If the app tries to restore positions immediately on monitor reconnect, the display topology may not be fully settled yet (Windows sends 2-3 `WM_DISPLAYCHANGE` messages in quick succession as monitors reinitialize).

**Why it happens:** DisplayPort monitors "disappear" electrically when the display sleeps, unlike HDMI which maintains the connection. Windows reacts to monitor loss by moving windows to surviving displays. The reconnect sequence is asynchronous and multi-step.

**Prevention:**
- Listen for `WM_DISPLAYCHANGE` events (available through Tauri's native event system or a Rust-side window procedure hook)
- On monitor reconnect: wait 2-3 seconds after the LAST `WM_DISPLAYCHANGE` before attempting to restore window positions (debounce the display change events)
- Before restoring, enumerate current monitors and validate that the target monitor exists and has the expected resolution
- Store monitor identifiers (device path, not just index) alongside window positions so you can match windows to the correct monitor even if the enumeration order changes

**Detection:** Unplug a monitor, wait, plug it back in. Windows that were on the disconnected monitor should return to their positions on that monitor, not stay piled on the other one.

**Phase:** Position restoration phase. This is a refinement of the core position tracking system, but should be designed for from the start even if implemented later.

**Confidence:** MEDIUM -- well-documented Windows behavior, but Tauri's exposure of `WM_DISPLAYCHANGE` may require native Rust hooks.

**Sources:**
- [WM_DISPLAYCHANGE - Microsoft Learn](https://learn.microsoft.com/en-us/windows/win32/gdi/wm-displaychange)
- [PowerToys issue: Restore window position on monitor reconnect - GitHub #261](https://github.com/microsoft/PowerToys/issues/261)
- [DisplayFusion: Restore positions on DisplayPort disconnect](https://www.displayfusion.com/Discussions/View/restore-window-positions-due-to-displayport-disconnect/?ID=e0d04ab3-527d-4f3a-8aaa-989da403734c)

---

### Pitfall 6: Warp Terminal Has Limited Programmatic Launch Control

**What goes wrong:** Warp terminal on Windows lacks mature CLI flags for programmatic launching. You can't reliably specify "open a new window at this directory and run this command" from a parent process. Warp may reuse an existing instance instead of opening a new window, and the CLI interface for specifying working directories and initial commands is limited compared to Windows Terminal or PowerShell.

**Why it happens:** Warp is relatively new on Windows. Its CLI/programmatic interface is still evolving. The macOS version has better CLI support, but Windows parity is incomplete.

**Consequences:**
- `warp.exe` may focus an existing window instead of creating a new one
- No reliable way to pass `claude -r <sessionId>` as an initial command to execute
- Working directory specification may require Launch Configurations (YAML files) rather than command-line args
- Breakage when Warp updates its CLI interface

**Prevention:**
- Abstract terminal launching behind a configurable interface from day one (the project already plans this)
- Implement at least two terminal backends: Warp and Windows Terminal (`wt.exe`), which has a well-documented CLI: `wt -d "C:\path" cmd /k "claude -r sessionId"`
- For Warp: investigate Launch Configurations (YAML-based session definitions) as the programmatic interface rather than CLI flags
- Test terminal launching as a standalone spike before integrating it into the app

**Detection:** Try launching 3 Warp windows programmatically with different working directories and commands. If any reuse an existing instance or ignore the working directory, this pitfall is active.

**Phase:** Terminal launcher implementation phase. Since the terminal abstraction layer is planned, this pitfall is manageable if addressed early.

**Confidence:** MEDIUM -- based on Warp documentation and GitHub feature requests. Warp's Windows support is actively evolving, so capabilities may improve.

**Sources:**
- [Warp CLI docs](https://docs.warp.dev/developers/cli)
- [Warp Launch Configurations docs](https://docs.warp.dev/terminal/sessions/launch-configurations)
- [Warp issue: CLI options to start Warp - GitHub #4548](https://github.com/warpdotdev/Warp/issues/4548)
- [Warp issue: Launch in particular directory - GitHub #2215](https://github.com/warpdotdev/Warp/issues/2215)

---

### Pitfall 7: Tauri Window-State Plugin Saves Invalid Data When Window Is Minimized

**What goes wrong:** On Windows, minimizing a window fires `Resized` and `Moved` events with invalid values (position becomes something like (-32000, -32000) -- the Windows "minimized offscreen" coordinates). If the window-state plugin or your custom position tracker persists these values, the next restore places the window at an invisible location. The user sees nothing and thinks the app is broken.

**Why it happens:** Windows moves minimized windows to a special offscreen coordinate. Event-driven position tracking captures this as a legitimate move. The plugin persists it to disk. On next launch, the plugin restores the window to (-32000, -32000).

**Consequences:** App becomes "invisible" after being closed while minimized. Users must delete the `.window-state` file or the app's position data to recover. This has been reported as a persistent bug in the Tauri plugin ecosystem.

**Prevention:**
- Filter out position updates where x or y is less than -10000 (sentinel for minimized state on Windows)
- Before persisting any position, check the window's "is_minimized" state and skip the save
- On restore, validate coordinates against current monitor bounds. If the position is outside all monitors, fall back to a centered default position
- Store the "normal" (non-minimized, non-maximized) window rect separately from the current state

**Detection:** Minimize the app, close it (via taskbar right-click > Close), reopen. If the window is invisible, this pitfall is active.

**Phase:** Position tracking implementation. Must be handled alongside crash-safe persistence (Pitfall 1).

**Confidence:** HIGH -- documented Tauri plugin bug with multiple reports.

**Sources:**
- [Tauri plugin issue: Minimized window invalid state - GitHub #253](https://github.com/tauri-apps/plugins-workspace/issues/253)
- [Tauri plugin issue: Window state very buggy - GitHub #3289](https://github.com/tauri-apps/plugins-workspace/issues/3289)

---

### Pitfall 8: WebView2 Runtime Issues on Windows

**What goes wrong:** Tauri relies on WebView2 (Chromium-based) for rendering the frontend. While Windows 11 ships with WebView2 pre-installed, several runtime issues can occur: WebView2 fails to start under Administrator Protection (different user context), first-run creation errors on some systems, and the WebView2 user data directory can become locked or corrupted.

**Why it happens:** WebView2 runs in a separate process with its own user data directory. If the app runs elevated or in a different user context, WebView2 can't access its data directory. Enterprise environments may have policies that restrict WebView2. The runtime auto-updates independently, so behavior can change between app releases.

**Consequences:**
- App fails to start with cryptic "failed to create webview" errors
- Intermittent first-run failures (works on second launch)
- Enterprise deployments may be blocked by WebView2 policies

**Prevention:**
- Set a custom WebView2 user data directory in Tauri config to avoid conflicts with other apps
- Handle WebView2 creation failure gracefully: show a native (non-webview) error dialog explaining the issue
- Test the app on a clean Windows 11 install, not just your development machine
- Don't run the app elevated (avoid "Run as Administrator") -- WebView2 has documented issues with elevated processes under Administrator Protection

**Detection:** Test on a fresh Windows 11 VM with no development tools installed. If the app fails to launch, WebView2 initialization needs hardening.

**Phase:** Initial Tauri app scaffolding phase. This is framework-level and should be verified early.

**Confidence:** MEDIUM -- affects a minority of users but with severe impact (app won't start). Well-documented in Tauri issues.

**Sources:**
- [WebView2 fails under Administrator Protection - GitHub #13926](https://github.com/tauri-apps/tauri/issues/13926)
- [WebView2 creation error - GitHub #7897](https://github.com/tauri-apps/tauri/issues/7897)
- [WebView2 runtime detection issues - GitHub #13817](https://github.com/tauri-apps/tauri/issues/13817)

---

## Minor Pitfalls

### Pitfall 9: Orphaned Terminal Processes After App Crash

**What goes wrong:** If the Tauri app crashes or is killed, spawned terminal processes continue running as orphans. Over time, this accumulates background processes consuming memory and potentially holding file locks.

**Prevention:**
- Use Windows Job Objects: create a Job Object with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` and assign all spawned terminal processes to it. When the Tauri app's process handle closes (including crash), Windows automatically terminates all processes in the job.
- As a fallback, persist a list of spawned PIDs and clean up stale ones on next app launch
- Note: this is a tradeoff -- for this project, orphaned terminals might be acceptable since the user may want terminals to survive an app restart. Make this configurable.

**Phase:** Terminal spawning phase. Design the Job Object approach but make it opt-in since users may prefer terminals to survive app crashes.

**Confidence:** HIGH -- standard Windows process management challenge.

**Sources:**
- [Tauri: Kill process on exit - Discussion #3273](https://github.com/tauri-apps/tauri/discussions/3273)
- [Tauri: Spawned children can't be killed on Windows - GitHub #4949](https://github.com/tauri-apps/tauri/issues/4949)

---

### Pitfall 10: Windows Path Encoding in Claude Session Directory Names

**What goes wrong:** Claude Code encodes project paths into directory names by replacing path separators and special characters with hyphens. `C:\Users\USERNAME\Documents\project` becomes `C--Users-USERNAME-Documents-project`. This encoding is not officially documented and could change. Paths with unusual characters (spaces, unicode, long paths) may encode differently than expected.

**Prevention:**
- Don't hardcode the encoding algorithm -- discover project directories by scanning `~/.claude/projects/` and matching against known project paths
- Handle Windows long paths (> 260 chars) which may be truncated in directory names
- Test with project paths containing spaces, unicode characters, and deep nesting

**Phase:** Session discovery phase.

**Confidence:** MEDIUM -- the encoding scheme is observed behavior, not a documented contract.

**Sources:**
- [Claude Code Session Storage - ClaudeWorld](https://claude-world.com/tutorials/s16-session-storage/)

---

### Pitfall 11: Tauri External Command Spawns App Clone

**What goes wrong:** On Windows, when a Tauri app with `windows_subsystem = "windows"` spawns an external command, it can sometimes spawn a clone of itself instead of the intended process. This is a documented Tauri bug that occurs with certain command invocations.

**Prevention:**
- Always use absolute paths to the terminal executable, never rely on PATH resolution for the primary launch command
- Test terminal spawning in release mode specifically (debug mode has a console and behaves differently)
- If the issue occurs, use `creation_flags` to explicitly specify `DETACHED_PROCESS` or `CREATE_NEW_CONSOLE`

**Phase:** Terminal spawning phase.

**Confidence:** MEDIUM -- documented but may be resolved in newer Tauri versions.

**Sources:**
- [External command spawns Tauri app clone - GitHub #8551](https://github.com/tauri-apps/tauri/issues/8551)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Tauri app scaffolding | WebView2 runtime failures (Pitfall 8) | Test on clean Windows 11 VM early |
| Session data reading | Undocumented JSONL format (Pitfall 2) | Defensive parsing, size limits, abstraction layer |
| Session data reading | Path encoding assumptions (Pitfall 10) | Scan directories, don't construct paths |
| Terminal launching | GUI subsystem can't spawn console (Pitfall 4) | Use raw `std::process::Command` with `creation_flags`, not Tauri sidecar |
| Terminal launching | Warp CLI limitations (Pitfall 6) | Abstract terminal backend, implement Windows Terminal as fallback |
| Terminal launching | Orphan processes (Pitfall 9) | Job Objects or accept orphans as intentional |
| Terminal launching | App clone spawning (Pitfall 11) | Absolute paths, release-mode testing |
| Window position tracking | Close-only persistence loses crash data (Pitfall 1) | Periodic + event-driven saves from day one |
| Window position tracking | Minimized window invalid coordinates (Pitfall 7) | Filter sentinel values, validate on restore |
| Window position tracking | DPI scaling breaks coordinates (Pitfall 3) | Store physical coords + monitor ID + DPI |
| Window position tracking | Monitor disconnect scrambles positions (Pitfall 5) | Debounced WM_DISPLAYCHANGE handling |

## Pitfall Interaction Map

Several pitfalls compound each other:

- **Pitfall 1 + Pitfall 7:** If you implement periodic position saves (to survive crashes) but don't filter minimized-window coordinates, you'll persistently save invalid positions -- making the crash worse than losing them entirely.
- **Pitfall 3 + Pitfall 5:** DPI scaling issues are amplified during monitor disconnect/reconnect because Windows may reassign DPI contexts when monitors reinitialize in a different order.
- **Pitfall 2 + Pitfall 10:** Both relate to Claude Code's undocumented internal file structures. They should be handled by the same abstraction layer and tested together when Claude Code updates.
- **Pitfall 4 + Pitfall 6 + Pitfall 11:** All three affect terminal spawning on Windows. The terminal abstraction layer must account for all of them simultaneously.

## Key Takeaway

The two highest-risk areas are:

1. **Window position tracking** (Pitfalls 1, 3, 5, 7) -- This is the project's core value proposition and the Windows multi-monitor + DPI landscape is a minefield. Every decision in position tracking must account for crashes, DPI differences, and monitor topology changes from the initial design.

2. **Claude Code session format dependency** (Pitfalls 2, 10) -- Building on undocumented, unstable internal file formats creates ongoing maintenance burden. The parser must be defensive, abstracted, and tested against real files to catch format changes early.
