# Phase 2: Session Resume - Research

**Researched:** 2026-03-28
**Domain:** Terminal process spawning, Warp CLI integration, Claude Code session resume, SolidJS UI panels
**Confidence:** MEDIUM (Warp CLI is the primary uncertainty)

## Summary

Phase 2 transforms the discovery-only DevPanel into a functional session launcher. The core technical challenge is spawning visible terminal windows from a Tauri GUI process on Windows -- complicated by Warp's limited programmatic launch support and the GUI subsystem's inability to directly create console children (Pitfall 4).

**Warp's CLI (`warp.exe`) is actually the Oz cloud agent CLI, NOT the terminal launcher.** The terminal is launched via Windows URI scheme (`warp://action/new_window?path=<dir>`) which IS registered on this machine. However, the URI scheme does NOT support passing an initial command (the `&command=` parameter is an open feature request, not implemented). This means the `claude -r <session_id>` command cannot be injected directly through the URI scheme -- it must be typed manually or injected via an alternative approach (launch configurations or a shell wrapper).

**Primary recommendation:** Use a two-strategy approach: (1) Warp via URI scheme `warp://action/new_window?path=<dir>` for opening at the right directory, with a programmatically-generated launch configuration YAML as the preferred path for including the `claude -r` command; (2) PowerShell as fallback using `powershell.exe -NoExit -Command "cd '<dir>'; claude -r <session_id>"`. Both strategies need the Pitfall 4 mitigation (raw `std::process::Command` with `CREATE_NEW_CONSOLE` creation flag).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **CRITICAL: Terminal Backend Correction** -- Warp is the terminal, NOT Windows Terminal. All planning files that reference Windows Terminal need to be updated. Warp is the spec. If Warp's closed-source nature creates technical barriers, surface the issue to the user rather than silently switching.
- **Resume UI Layout** -- Upgrade existing DevPanel (add Resume + Select Session buttons). Throwaway UI. Session list opens in a slide-in side panel from right. Project list stays visible on left.
- **Terminal Launch** -- Warp as primary, PowerShell as fallback. Terminal abstraction layer (configurable backend). Simple settings UI dropdown for terminal choice.
- **Session Selection** -- Side panel with timestamp + last user message + session duration. Sorted by most recent.
- **Resume Feedback** -- App stays open after launch. Error toast (auto-dismiss). Persistent error log in settings. Active session indicator (PID alive check).

### Deferred Ideas (OUT OF SCOPE)
- Relative timestamps ("2 hours ago") -- deferred to Phase 3
- Tab grouping (multiple sessions in one terminal window) -- v2
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RESU-01 | Resume button opens terminal with most recent session via `claude -r` | Warp URI scheme + launch config strategy; PowerShell fallback; `claude --resume <session_id>` syntax confirmed |
| RESU-02 | Select Session then choosing a session opens terminal with that session via `claude -r <session_id>` | Same terminal strategy; `claude -r <session_id>` confirmed working |
| RESU-03 | Terminal opens cd'd to project directory | Warp URI `path=` param confirmed; PowerShell `-Command "cd '<dir>'"` |
| RESU-04 | Terminal backend is configurable (Warp default, PowerShell fallback) | Terminal trait pattern; Store plugin for settings persistence |
| SESS-01 | User can view list of all sessions for a project | Existing `list_sessions` command already returns sessions per project |
| SESS-02 | Each session shows creation timestamp | `first_timestamp` already extracted by scanner |
| SESS-03 | Each session shows truncated last user message | `last_user_message` already extracted by scanner |
| SESS-04 | Session list sorted by most recent activity | Already sorted by `last_timestamp` descending in discovery.rs |
</phase_requirements>

## Standard Stack

### Core (Phase 2 Additions)

| Library/Crate | Version | Purpose | Why Standard |
|---------------|---------|---------|--------------|
| `tauri-plugin-shell` | ~2.3 | Spawn terminal processes from Tauri | Official Tauri plugin for process spawning. Needed for `tauri::api::shell::open` to trigger URI schemes, and for `Command::new` for PowerShell fallback |
| `tauri-plugin-store` | ~2.4 | Persist terminal settings, error log | Already in Cargo.toml. Used for settings (terminal choice) and error log persistence |
| `std::process::Command` | stdlib | Direct process spawning with `CREATE_NEW_CONSOLE` | Required for PowerShell fallback; Tauri's shell plugin may not expose `creation_flags` |

### Already Available (from Phase 1)

| Component | Status | Phase 2 Usage |
|-----------|--------|---------------|
| `list_sessions` command | Working | Backend for session side panel |
| `SessionInfo` struct | Has first_timestamp, last_timestamp, last_user_message | Add `session_duration` computed field on frontend |
| `scanner.rs` | Extracts first + last timestamps | Duration = last_timestamp - first_timestamp (compute in TypeScript) |
| DevPanel.tsx | Working project table + session table | Add Resume/Select buttons + side panel |
| Store plugin | Configured | Use for terminal settings + error log |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Warp URI scheme | Warp launch configurations (YAML) | Launch configs can include commands but cannot be triggered programmatically from CLI -- no known API to open a specific launch config from external process |
| `tauri-plugin-shell` for spawning | Raw `std::process::Command` | Shell plugin adds permission scoping but may hide `creation_flags` needed for visible console windows. May need raw Command for PowerShell path |
| PID polling for alive check | `sysinfo` crate | Heavier dependency; `try_wait()` on `Child` is sufficient for processes we spawn ourselves |

## Architecture Patterns

### New Rust Module Structure
```
src-tauri/src/
  commands/
    discovery.rs     # Existing -- list_projects, list_sessions
    launcher.rs      # NEW -- resume_session, get_terminal_status
    settings.rs      # NEW -- get_settings, update_settings
  services/
    scanner.rs       # Existing
    watcher.rs       # Existing
    terminal/        # NEW
      mod.rs         # TerminalLauncher trait + factory
      warp.rs        # Warp implementation (URI scheme + launch config)
      powershell.rs  # PowerShell implementation
  models/
    project.rs       # Existing
    session.rs       # Existing -- add SessionDuration or compute in frontend
    settings.rs      # NEW -- TerminalConfig, ErrorLogEntry
```

### Pattern 1: Terminal Abstraction Trait
**What:** Rust trait `TerminalLauncher` with implementations per terminal backend
**When to use:** Every terminal launch operation
**Example:**
```rust
// src-tauri/src/services/terminal/mod.rs
use std::process::Child;

pub trait TerminalLauncher: Send + Sync {
    /// Launch a terminal at the given directory, optionally running a command
    fn launch(
        &self,
        working_dir: &str,
        command: Option<&str>,
    ) -> Result<LaunchResult, LaunchError>;

    /// Check if a previously launched process is still alive
    fn is_alive(&self, pid: u32) -> bool;

    /// Human-readable name for settings UI
    fn name(&self) -> &str;

    /// Whether this terminal is available on the system
    fn is_available(&self) -> bool;
}

pub struct LaunchResult {
    pub pid: u32,
    pub process: Option<Child>,  // None for URI-scheme launches
}
```

### Pattern 2: Warp Launch Strategy (Two-Phase)
**What:** Open Warp at directory via URI, then user types command (or use launch config)
**Why:** URI scheme supports `path=` but NOT `command=`. Launch configs support commands but have no external trigger API.

**Strategy A (URI scheme -- simpler, no command injection):**
```rust
// Opens Warp in the right directory. User must type `claude -r <id>` manually.
// Or: we copy the command to clipboard before launching.
fn launch_warp_uri(working_dir: &str) -> Result<(), LaunchError> {
    let uri = format!("warp://action/new_window?path={}", urlencoded(working_dir));
    // Use Windows ShellExecuteW or tauri::api::shell::open
    open::that(&uri)?;
    Ok(())
}
```

**Strategy B (Programmatic launch config -- full command support):**
```rust
// Write a temporary YAML launch config, then open it via URI scheme
fn launch_warp_with_command(working_dir: &str, command: &str) -> Result<(), LaunchError> {
    let yaml = format!(r#"---
name: workspace-resume-session
windows:
  - tabs:
    - title: Claude Session
      layout:
        cwd: "{working_dir}"
        commands:
          - exec: "{command}"
"#);
    // Write to %LOCALAPPDATA%\Warp\Warp\data\launch_configurations\
    let config_path = warp_launch_config_dir().join("_workspace_resume_temp.yaml");
    std::fs::write(&config_path, yaml)?;
    // Open via URI: warp://launch/<path>
    let uri = format!("warp://launch/{}", config_path.display());
    open::that(&uri)?;
    Ok(())
}
```

### Pattern 3: PowerShell Fallback (Reliable)
**What:** Direct process spawn with `CREATE_NEW_CONSOLE`
**When to use:** When Warp is unavailable or user selects PowerShell in settings
```rust
use std::os::windows::process::CommandExt;

const CREATE_NEW_CONSOLE: u32 = 0x00000010;

fn launch_powershell(working_dir: &str, command: Option<&str>) -> Result<Child, LaunchError> {
    let cmd = match command {
        Some(cmd) => format!("Set-Location '{}'; {}", working_dir, cmd),
        None => format!("Set-Location '{}'", working_dir),
    };

    let child = std::process::Command::new("powershell.exe")
        .args(["-NoExit", "-Command", &cmd])
        .creation_flags(CREATE_NEW_CONSOLE)
        .spawn()?;

    Ok(child)
}
```

### Pattern 4: Active Session Tracking (PID Polling)
**What:** Store spawned PIDs, poll `try_wait()` or Win32 `OpenProcess` to check liveness
```rust
use std::collections::HashMap;
use std::sync::Mutex;

pub struct SessionTracker {
    // Maps session_id -> (pid, Child handle if available)
    active: Mutex<HashMap<String, TrackedSession>>,
}

struct TrackedSession {
    pid: u32,
    child: Option<std::process::Child>,  // None for URI-launched processes
    launched_at: std::time::Instant,
}

impl SessionTracker {
    pub fn is_session_active(&self, session_id: &str) -> bool {
        let mut active = self.active.lock().unwrap();
        if let Some(tracked) = active.get_mut(session_id) {
            if let Some(ref mut child) = tracked.child {
                // We own the Child handle -- use try_wait
                match child.try_wait() {
                    Ok(Some(_)) => { active.remove(session_id); false }
                    Ok(None) => true,
                    Err(_) => { active.remove(session_id); false }
                }
            } else {
                // URI-launched: check PID via Win32 OpenProcess
                is_pid_alive(tracked.pid)
            }
        } else {
            false
        }
    }
}
```

### Pattern 5: Side Panel UI (SolidJS)
**What:** Slide-in panel from right side showing sessions for selected project
```tsx
// Slide-in panel using CSS transform
function SessionPanel(props: { project: ProjectInfo | null; onClose: () => void }) {
  return (
    <div class={`session-panel ${props.project ? 'open' : ''}`}>
      {/* Panel content: session list with Resume buttons */}
    </div>
  );
}

// CSS: .session-panel { transform: translateX(100%); transition: transform 0.2s; }
// CSS: .session-panel.open { transform: translateX(0); }
```

### Anti-Patterns to Avoid
- **Using Tauri sidecar for terminal spawning:** Sidecars are for headless background processes -- they actively hide console windows (Pitfall 4)
- **Assuming `warp.exe` is a terminal launcher:** It is the Oz CLI. The terminal is launched via URI scheme or by Windows opening the executable directly
- **Computing session duration on the Rust side:** Unnecessary complexity. Both timestamps are already sent to the frontend. Compute duration in TypeScript: `new Date(last) - new Date(first)`
- **Using `tauri-plugin-shell`'s `Command::new()` for visible terminals:** The shell plugin may not expose Windows `creation_flags`. Use `std::process::Command` with `CommandExt` for PowerShell fallback

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URI scheme opening | Custom Win32 ShellExecuteW call | `open` crate (0.5.x) or `tauri::api::shell::open` | Cross-platform URI opener, handles Windows URL protocol dispatch |
| YAML serialization | String formatting for launch configs | `serde_yaml` crate | Proper escaping of paths with spaces, quotes, special chars |
| Toast notifications | Custom toast system | CSS transition + `setTimeout` auto-dismiss | Throwaway UI -- keep it minimal, no library needed |
| Settings persistence | File I/O for settings | `tauri-plugin-store` (already installed) | Atomic writes, crash-safe, JSON key-value |

**Key insight:** This phase's UI is explicitly throwaway (replaced by Phase 3 dashboard). Invest engineering effort in the Rust terminal abstraction layer (which persists), not in polished UI components.

## Common Pitfalls

### Pitfall 1: Warp URI Scheme Has No Command Parameter
**What goes wrong:** Developer assumes `warp://action/new_window?path=<dir>&command=claude -r <id>` will work. It won't -- `command` parameter is an open feature request (GitHub #5859), not implemented.
**Why it happens:** The `path=` parameter works, so developers assume `command=` would too.
**How to avoid:** Use the launch configuration YAML approach (Strategy B) for full command injection, or accept that Warp launches open to the right directory but require the user to type/paste the resume command. A clipboard-copy UX is a pragmatic middle ground.
**Warning signs:** Warp opens to correct directory but no command runs.

### Pitfall 2: `warp.exe` Is Oz CLI, Not Terminal Launcher
**What goes wrong:** Calling `warp.exe --some-flag` expecting terminal behavior. Instead you get cloud agent CLI responses.
**Why it happens:** The same binary serves double duty. With no args/URLs it may open the terminal GUI, but with subcommands it acts as Oz CLI.
**How to avoid:** Use `warp://` URI scheme via `ShellExecuteW` or `open::that()`, never invoke `warp.exe` directly with custom flags.
**Warning signs:** Getting JSON/text output about "orchestration platform for cloud agents" instead of a terminal window.

### Pitfall 3: GUI Subsystem Cannot Spawn Visible Consoles (Pitfall 4 from PITFALLS.md)
**What goes wrong:** PowerShell window doesn't appear when spawned from release build.
**Why it happens:** Tauri release builds use `#![windows_subsystem = "windows"]` which gives the process no console. Child processes inherit invalid stdio handles.
**How to avoid:** Use `creation_flags(CREATE_NEW_CONSOLE)` on `std::process::Command`. Test in RELEASE mode, not dev.
**Warning signs:** Works in `cargo tauri dev` but fails in `cargo tauri build`.

### Pitfall 4: URI-Launched Processes Have No PID
**What goes wrong:** `open::that("warp://...")` returns success but provides no PID for tracking.
**Why it happens:** URI scheme dispatch goes through Windows Shell, which spawns the process indirectly. There's no `Child` handle returned.
**How to avoid:** For Warp: after URI launch, enumerate windows via `EnumWindows` to find the new Warp window by process name. For PowerShell (direct spawn): use `child.id()` directly. Accept that Warp PID tracking is best-effort.
**Warning signs:** Active session indicator never shows "running" for Warp-launched sessions.

### Pitfall 5: Warp Launch Config Path Escaping on Windows
**What goes wrong:** YAML launch config with Windows paths containing backslashes or spaces breaks parsing.
**Why it happens:** YAML treats backslash as escape character. `C:\Users\USERNAME\Documents` becomes invalid.
**How to avoid:** Use forward slashes in YAML `cwd` values (`C:/Users/USERNAME/Documents`) or double-escape. Use `serde_yaml` for serialization instead of string formatting.
**Warning signs:** Warp shows error or opens to wrong directory.

### Pitfall 6: `claude -r` Must Be Run FROM the Project Directory
**What goes wrong:** `claude -r <session_id>` is called from the wrong directory and either fails or creates a new session.
**Why it happens:** Claude Code scopes sessions by working directory. The session ID alone is not sufficient -- the CWD must match the project.
**How to avoid:** Always `cd` to the project directory before running `claude -r`. For PowerShell: `Set-Location '<dir>'; claude -r <id>`. For Warp launch configs: set `cwd` field.
**Warning signs:** Claude opens a fresh session instead of resuming.

## Code Examples

### claude -r Syntax (Verified)
```bash
# Resume most recent session in current directory (interactive picker)
claude -r

# Resume specific session by ID
claude -r abc123-def456-...
# or equivalently:
claude --resume abc123-def456-...

# Resume with fork (new session ID, same context)
claude -r abc123 --fork-session
```
Source: `claude --help` output on this machine (verified 2026-03-28)

### Warp URI Scheme (Verified via Registry)
```
# Open new Warp window at directory
warp://action/new_window?path=C:/Users/USERNAME/Documents/project

# Open new Warp tab at directory
warp://action/new_tab?path=C:/Users/USERNAME/Documents/project

# Open a launch configuration
warp://launch/<launch_configuration_path>
```
Registry key: `HKCU\Software\Classes\warp\shell\open\command` = `"C:\Users\USERNAME\AppData\Local\Programs\Warp\warp.exe" "%0"`
Source: Warp docs + registry verification on this machine

### Warp Launch Configuration YAML Format
```yaml
---
name: workspace-resume-session
windows:
  - tabs:
    - title: Claude Session
      layout:
        cwd: "C:/Users/USERNAME/Documents/project"
        commands:
          - exec: "claude -r abc123-session-id"
```
**Storage location (Windows):** `%LOCALAPPDATA%\Warp\Warp\data\launch_configurations\`
**Note:** Directory exists on this machine at `C:\Users\USERNAME\AppData\Local\Warp\Warp\data\` but `launch_configurations\` subdirectory does not yet exist (must be created).

Source: [Warp Launch Configurations docs](https://docs.warp.dev/terminal/sessions/launch-configurations)

### PowerShell Spawn from Rust (Windows GUI Process)
```rust
use std::os::windows::process::CommandExt;

const CREATE_NEW_CONSOLE: u32 = 0x00000010;

let child = std::process::Command::new("powershell.exe")
    .args([
        "-NoExit",
        "-Command",
        &format!("Set-Location '{}'; claude -r {}", project_dir, session_id),
    ])
    .creation_flags(CREATE_NEW_CONSOLE)
    .spawn()
    .map_err(|e| format!("Failed to launch PowerShell: {}", e))?;

let pid = child.id();
```
Source: [Rust CommandExt docs](https://doc.rust-lang.org/std/os/windows/process/trait.CommandExt.html)

### PID Alive Check via Win32
```rust
use windows::Win32::System::Threading::{OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION};
use windows::Win32::Foundation::CloseHandle;

fn is_pid_alive(pid: u32) -> bool {
    unsafe {
        match OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) {
            Ok(handle) => {
                let _ = CloseHandle(handle);
                true
            }
            Err(_) => false,
        }
    }
}
```
Source: [Win32 OpenProcess docs](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-openprocess)

### IPC Command for Resume (Tauri)
```rust
#[tauri::command]
pub async fn resume_session(
    encoded_project: String,
    session_id: String,
    project_path: String,
    state: tauri::State<'_, SessionTracker>,
) -> Result<ResumeResult, String> {
    let settings = load_settings()?;
    let launcher = create_launcher(&settings)?;

    let command = if session_id.is_empty() {
        "claude -r".to_string()
    } else {
        format!("claude -r {}", session_id)
    };

    let result = launcher.launch(&project_path, Some(&command))?;

    // Track the launched session
    state.track(session_id.clone(), result.pid, result.process);

    Ok(ResumeResult {
        pid: result.pid,
        terminal: launcher.name().to_string(),
    })
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `warp-cli` for Warp control | `oz` CLI (warp-cli deprecated) | 2025 | `warp-cli` commands now available as `oz` but neither launches the terminal GUI |
| `wt.exe` for terminal launch | Warp as primary (user decision) | Phase 2 correction | All Windows Terminal references in STACK.md need updating |
| Tauri sidecar for process spawning | Direct `std::process::Command` | Pitfall 4 finding | Sidecars hide console windows; use raw Command with creation_flags |

## Open Questions

1. **Warp launch config URI trigger reliability**
   - What we know: `warp://launch/<path>` is documented in URI scheme docs
   - What's unclear: Does it work on Windows? Does it auto-create the `launch_configurations` directory? Does the launch config need to exist before Warp starts?
   - Recommendation: Test Strategy B (launch config) as a spike in Wave 1. If unreliable, fall back to Strategy A (URI + clipboard copy of command).

2. **PID tracking for Warp URI-launched sessions**
   - What we know: URI scheme provides no PID. `EnumWindows` + process name matching could find Warp windows.
   - What's unclear: After `warp://action/new_window`, does Warp reuse its existing process or spawn a new one? If it reuses, there's only one PID for all windows.
   - Recommendation: For Warp, check if Warp is running (by process name) rather than tracking individual window PIDs. Mark as "best effort" for Phase 2.

3. **`pwsh.exe` availability**
   - What we know: Only `powershell.exe` (5.1) is installed on this machine. `pwsh.exe` (PowerShell 7) is NOT available.
   - What's unclear: Whether `claude -r` works correctly in PowerShell 5.1 vs 7.
   - Recommendation: Use `powershell.exe` as the fallback binary, not `pwsh.exe`. Test `claude -r` in PowerShell 5.1.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Warp terminal | RESU-01, RESU-04 | Yes | Installed at `%LOCALAPPDATA%\Programs\Warp\warp.exe` | PowerShell |
| Warp URI scheme | Terminal launch | Yes | Registered in `HKCU\Software\Classes\warp` | PowerShell direct spawn |
| powershell.exe | Fallback terminal | Yes | 5.1.26100.7920 | -- |
| pwsh.exe | Preferred PS fallback | No | Not installed | Use powershell.exe (5.1) |
| claude CLI | Session resume | Yes | (on PATH via npm) | -- |
| tauri-plugin-shell | Process spawning | Not yet added | Needs install | std::process::Command |
| `open` crate | URI scheme dispatch | Not yet added | Needs install | tauri::api::shell::open |
| `serde_yaml` crate | Launch config gen | Not yet added | Needs install | String formatting (fragile) |
| `windows` crate | PID alive check | Not yet added | Needs install | `try_wait()` on owned Children |

**Missing dependencies with no fallback:** None -- all have alternatives.

**Missing dependencies to add:**
- `tauri-plugin-shell` -- add to Cargo.toml and `npm install @tauri-apps/plugin-shell`
- `open` crate -- for URI scheme dispatch (or use shell plugin's `open` API)
- `serde_yaml` -- for Warp launch config generation (or defer to string formatting)
- `windows` crate with `Win32_System_Threading` feature -- for PID alive checks

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Rust `cargo test` (unit tests in modules, integration in tests/) |
| Config file | Default Cargo test runner |
| Quick run command | `cd workspace-resume/src-tauri && cargo test` |
| Full suite command | `cd workspace-resume/src-tauri && cargo test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RESU-01 | Resume button launches terminal with most recent session | integration (manual -- requires terminal) | Manual verification | No -- Wave 0 |
| RESU-02 | Select session launches terminal with specific session ID | integration (manual) | Manual verification | No -- Wave 0 |
| RESU-03 | Terminal opens cd'd to project directory | integration (manual) | Manual verification | No -- Wave 0 |
| RESU-04 | Terminal backend is configurable | unit | `cargo test terminal::tests` | No -- Wave 0 |
| SESS-01 | User can view session list for a project | unit (existing) | `cargo test list_sessions` | Yes (discovery.rs tests) |
| SESS-02 | Session shows creation timestamp | unit (existing) | `cargo test test_normal_session_parses_all_fields` | Yes (scanner.rs tests) |
| SESS-03 | Session shows last user message | unit (existing) | `cargo test test_last_prompt_fast_path` | Yes (scanner.rs tests) |
| SESS-04 | Session list sorted by most recent | unit (existing) | `cargo test list_sessions` (verify sort order) | Partial |

### Sampling Rate
- **Per task commit:** `cd workspace-resume/src-tauri && cargo test`
- **Per wave merge:** Full test suite + manual terminal launch verification
- **Phase gate:** All Rust tests green + manual verification of Warp and PowerShell launch

### Wave 0 Gaps
- [ ] `src-tauri/src/services/terminal/mod.rs` -- TerminalLauncher trait + factory unit tests
- [ ] `src-tauri/src/services/terminal/powershell.rs` -- PowerShell command construction tests (no actual spawn)
- [ ] `src-tauri/src/services/terminal/warp.rs` -- Warp URI construction + YAML generation tests
- [ ] `src-tauri/src/commands/launcher.rs` -- IPC command unit tests (mock launcher)
- [ ] Manual test checklist for RESU-01 through RESU-03 (require actual terminal)

## Project Constraints (from CLAUDE.md)

- **Framework:** Tauri (Rust backend + system webview) -- locked
- **Platform:** Windows 11 only for v1
- **Terminal:** Warp as initial default, architecture must support swapping
- **Session data:** Read local Claude Code session files -- no API dependencies
- **Position tracking:** Must survive hard shutdowns (relevant for Phase 4, but terminal abstraction should not block this)
- **GSD Workflow:** All edits through GSD commands. No direct repo edits outside workflow.

## Sources

### Primary (HIGH confidence)
- `claude --help` output on this machine -- `-r, --resume [value]` flag confirmed with optional session ID
- Windows Registry `HKCU\Software\Classes\warp` -- URI scheme `warp://` registered, handler is `warp.exe "%0"`
- Warp installation verified at `C:\Users\USERNAME\AppData\Local\Programs\Warp\warp.exe`
- PowerShell 5.1 verified at `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`
- [Rust CommandExt::creation_flags](https://doc.rust-lang.org/std/os/windows/process/trait.CommandExt.html) -- HIGH
- Existing codebase: scanner.rs already extracts first_timestamp + last_timestamp

### Secondary (MEDIUM confidence)
- [Warp URI Scheme docs](https://docs.warp.dev/terminal/more-features/uri-scheme) -- `new_window`, `new_tab`, `launch` actions confirmed
- [Warp Launch Configurations docs](https://docs.warp.dev/terminal/sessions/launch-configurations) -- YAML format with `cwd` and `commands` fields
- [GitHub #5859](https://github.com/warpdotdev/Warp/issues/5859) -- `command` param in URI scheme NOT implemented (open request)
- [GitHub #4548](https://github.com/warpdotdev/Warp/issues/4548) -- CLI launch flags resolved via URI scheme (closed Oct 2025)
- [GitHub #3780](https://github.com/warpdotdev/Warp/issues/3780) -- Programmatic launch configs work if YAML syntax is correct

### Tertiary (LOW confidence)
- Warp launch config directory on Windows (`%LOCALAPPDATA%\Warp\Warp\data\launch_configurations\`) -- documented for macOS/Linux, assumed similar for Windows. Directory structure confirmed but `launch_configurations` subdir doesn't exist yet on this machine.
- `warp://launch/<path>` URI for opening specific launch configs -- documented but untested on Windows

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Tauri, SolidJS, Rust patterns are well-established from Phase 1
- Terminal abstraction architecture: HIGH -- trait pattern is straightforward Rust
- Warp integration: MEDIUM -- URI scheme confirmed registered but `warp://launch/` + command injection via YAML is untested on Windows
- PowerShell fallback: HIGH -- `std::process::Command` with `CREATE_NEW_CONSOLE` is well-documented
- PID tracking: MEDIUM -- trivial for PowerShell (owned Child), best-effort for Warp (URI-launched)
- Session duration: HIGH -- both timestamps already available, trivial frontend computation

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (Warp CLI evolves quickly -- recheck URI scheme capabilities if delayed)
