use super::{LaunchError, LaunchResult, TerminalLauncher};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// CREATE_NEW_CONSOLE flag for Windows process creation.
/// Required because Tauri release builds use the Windows GUI subsystem
/// which cannot spawn visible console children without this flag.
/// See Pitfall 3 in 02-RESEARCH.md.
#[cfg(windows)]
const CREATE_NEW_CONSOLE: u32 = 0x00000010;

pub struct PowerShellLauncher;

impl PowerShellLauncher {
    pub fn new() -> Self {
        Self
    }

    /// Build the PowerShell command string for launching at a directory
    pub fn build_command(working_dir: &str, command: Option<&str>) -> String {
        match command {
            Some(cmd) => format!("Set-Location '{}'; {}", working_dir, cmd),
            None => format!("Set-Location '{}'", working_dir),
        }
    }

    /// Build the full argument list for powershell.exe
    pub fn build_args(working_dir: &str, command: Option<&str>) -> Vec<String> {
        let ps_command = Self::build_command(working_dir, command);
        vec![
            "-NoExit".to_string(),
            "-Command".to_string(),
            ps_command,
        ]
    }
}

impl TerminalLauncher for PowerShellLauncher {
    fn launch(&self, working_dir: &str, command: Option<&str>) -> Result<LaunchResult, LaunchError> {
        if !self.is_available() {
            return Err(LaunchError::NotAvailable(
                "powershell.exe not found".into(),
            ));
        }

        let args = Self::build_args(working_dir, command);

        let mut cmd = std::process::Command::new("powershell.exe");
        cmd.args(&args);

        // Apply CREATE_NEW_CONSOLE on Windows to ensure visible console window
        #[cfg(windows)]
        {
            cmd.creation_flags(CREATE_NEW_CONSOLE);
        }

        let child = cmd
            .spawn()
            .map_err(|e| LaunchError::SpawnFailed(format!("Failed to launch PowerShell: {}", e)))?;

        let pid = child.id();

        Ok(LaunchResult {
            pid: Some(pid),
            child: Some(child),
        })
    }

    fn is_alive(&self, pid: u32) -> bool {
        // Use Win32 OpenProcess for PID alive check
        is_pid_alive(pid)
    }

    fn name(&self) -> &str {
        "PowerShell"
    }

    fn is_available(&self) -> bool {
        // Check if powershell.exe exists on PATH
        // On Windows this is always true, but verify to be safe
        which_powershell().is_some()
    }
}

/// Check if powershell.exe is available
fn which_powershell() -> Option<std::path::PathBuf> {
    // Try the known Windows path first
    let system_path = std::path::PathBuf::from(r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe");
    if system_path.exists() {
        return Some(system_path);
    }
    // Fallback: try to find on PATH via where command
    None
}

/// Check if a process is alive via Win32 OpenProcess
#[cfg(windows)]
fn is_pid_alive(pid: u32) -> bool {
    use windows::Win32::System::Threading::{OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION};
    use windows::Win32::Foundation::CloseHandle;

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

#[cfg(not(windows))]
fn is_pid_alive(_pid: u32) -> bool {
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_command_with_session() {
        let cmd = PowerShellLauncher::build_command(
            "C:\\Users\\USERNAME\\Documents\\project",
            Some("claude -r abc123"),
        );
        assert_eq!(
            cmd,
            "Set-Location 'C:\\Users\\USERNAME\\Documents\\project'; claude -r abc123"
        );
    }

    #[test]
    fn test_build_command_without_command() {
        let cmd = PowerShellLauncher::build_command(
            "C:\\Users\\USERNAME\\Documents\\project",
            None,
        );
        assert_eq!(cmd, "Set-Location 'C:\\Users\\USERNAME\\Documents\\project'");
    }

    #[test]
    fn test_build_args_structure() {
        let args = PowerShellLauncher::build_args(
            "C:\\Users\\USERNAME\\project",
            Some("claude -r"),
        );
        assert_eq!(args.len(), 3);
        assert_eq!(args[0], "-NoExit");
        assert_eq!(args[1], "-Command");
        assert!(args[2].contains("Set-Location"));
        assert!(args[2].contains("claude -r"));
    }

    #[test]
    fn test_build_args_no_exit_flag() {
        let args = PowerShellLauncher::build_args("C:\\test", None);
        assert_eq!(args[0], "-NoExit");
    }

    #[test]
    fn test_powershell_launcher_name() {
        let launcher = PowerShellLauncher::new();
        assert_eq!(launcher.name(), "PowerShell");
    }

    #[test]
    fn test_is_available_returns_bool() {
        let launcher = PowerShellLauncher::new();
        // Should return true on Windows, false elsewhere, but never panic
        let _available = launcher.is_available();
    }

    #[test]
    fn test_creation_flags_constant() {
        // Verify the CREATE_NEW_CONSOLE flag value
        #[cfg(windows)]
        assert_eq!(CREATE_NEW_CONSOLE, 0x00000010);
    }
}
