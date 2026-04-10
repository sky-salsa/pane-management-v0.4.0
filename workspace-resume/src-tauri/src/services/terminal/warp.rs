use super::{LaunchError, LaunchResult, TerminalLauncher};

pub struct WarpLauncher;

impl WarpLauncher {
    pub fn new() -> Self {
        Self
    }

    /// Get the expected Warp executable path
    fn warp_exe_path() -> Option<std::path::PathBuf> {
        let local_app_data = std::env::var("LOCALAPPDATA").ok()?;
        let path = std::path::PathBuf::from(local_app_data)
            .join("Programs")
            .join("Warp")
            .join("warp.exe");
        if path.exists() {
            Some(path)
        } else {
            None
        }
    }

    /// Get the Warp launch configurations directory (APPDATA per official docs)
    fn launch_config_dir() -> Option<std::path::PathBuf> {
        let app_data = std::env::var("APPDATA").ok()?;
        Some(
            std::path::PathBuf::from(app_data)
                .join("warp")
                .join("Warp")
                .join("data")
                .join("launch_configurations"),
        )
    }

    /// Build a warp://action/new_window URI for the given directory
    pub fn build_uri(working_dir: &str) -> String {
        let encoded_path = urlencoding::encode(working_dir);
        format!("warp://action/new_window?path={}", encoded_path)
    }

    /// Generate YAML content for a Warp launch configuration
    /// Paths use forward slashes per Pitfall 5 (Warp YAML backslash escaping)
    pub fn build_launch_config_yaml(working_dir: &str, command: &str) -> String {
        // Convert backslashes to forward slashes for YAML compatibility
        let safe_dir = working_dir.replace('\\', "/");
        let safe_command = command.to_string();

        // Use serde_yaml for proper escaping
        let config = serde_yaml::to_string(&serde_yaml::Value::Mapping({
            let mut root = serde_yaml::Mapping::new();
            root.insert(
                serde_yaml::Value::String("name".into()),
                serde_yaml::Value::String("workspace-resume-session".into()),
            );

            let mut commands_seq = serde_yaml::Sequence::new();
            let mut cmd_map = serde_yaml::Mapping::new();
            cmd_map.insert(
                serde_yaml::Value::String("exec".into()),
                serde_yaml::Value::String(safe_command),
            );
            commands_seq.push(serde_yaml::Value::Mapping(cmd_map));

            let mut layout = serde_yaml::Mapping::new();
            layout.insert(
                serde_yaml::Value::String("cwd".into()),
                serde_yaml::Value::String(safe_dir),
            );
            layout.insert(
                serde_yaml::Value::String("commands".into()),
                serde_yaml::Value::Sequence(commands_seq),
            );

            let mut tab = serde_yaml::Mapping::new();
            tab.insert(
                serde_yaml::Value::String("title".into()),
                serde_yaml::Value::String("Claude Session".into()),
            );
            tab.insert(
                serde_yaml::Value::String("layout".into()),
                serde_yaml::Value::Mapping(layout),
            );

            let mut tabs_seq = serde_yaml::Sequence::new();
            tabs_seq.push(serde_yaml::Value::Mapping(tab));

            let mut window = serde_yaml::Mapping::new();
            window.insert(
                serde_yaml::Value::String("tabs".into()),
                serde_yaml::Value::Sequence(tabs_seq),
            );

            let mut windows_seq = serde_yaml::Sequence::new();
            windows_seq.push(serde_yaml::Value::Mapping(window));

            root.insert(
                serde_yaml::Value::String("windows".into()),
                serde_yaml::Value::Sequence(windows_seq),
            );

            root
        }))
        .unwrap_or_default();

        config
    }

    /// Write a launch config YAML and launch warp.exe directly.
    /// The config is written to APPDATA so it appears in Warp's command palette.
    /// User triggers the config inside Warp (Ctrl+Shift+P → select config name).
    fn write_launch_config_and_open(
        &self,
        working_dir: &str,
        command: &str,
        config_name: &str,
    ) -> Result<std::process::Child, LaunchError> {
        let config_dir = Self::launch_config_dir()
            .ok_or_else(|| LaunchError::ConfigError("Cannot determine Warp config directory".into()))?;

        std::fs::create_dir_all(&config_dir)
            .map_err(|e| LaunchError::ConfigError(format!("Cannot create config dir: {}", e)))?;

        // Use a sanitized filename from the config name
        let safe_filename = config_name
            .chars()
            .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
            .collect::<String>();
        let config_path = config_dir.join(format!("_wr_{}.yaml", safe_filename));
        let yaml = Self::build_launch_config_yaml(working_dir, command);

        std::fs::write(&config_path, &yaml)
            .map_err(|e| LaunchError::ConfigError(format!("Cannot write launch config: {}", e)))?;

        // Launch warp.exe directly as a process
        let warp_path = Self::warp_exe_path()
            .ok_or_else(|| LaunchError::NotAvailable("warp.exe not found".into()))?;

        let child = std::process::Command::new(&warp_path)
            .spawn()
            .map_err(|e| LaunchError::SpawnFailed(format!("Failed to launch warp.exe: {}", e)))?;

        Ok(child)
    }
}

impl TerminalLauncher for WarpLauncher {
    fn launch(&self, working_dir: &str, command: Option<&str>) -> Result<LaunchResult, LaunchError> {
        if !self.is_available() {
            return Err(LaunchError::NotAvailable(
                "Warp is not installed or warp.exe not found".into(),
            ));
        }

        // Generate a config name from the working directory's last folder
        let dir_name = std::path::Path::new(working_dir)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("session");

        let cmd = command.unwrap_or("echo Ready");
        let config_name = format!("resume-{}", dir_name);

        match self.write_launch_config_and_open(working_dir, cmd, &config_name) {
            Ok(child) => {
                let pid = child.id();
                Ok(LaunchResult {
                    pid: Some(pid),
                    child: Some(child),
                })
            }
            Err(e) => Err(e),
        }
    }

    fn is_alive(&self, pid: u32) -> bool {
        is_pid_alive(pid)
    }

    fn name(&self) -> &str {
        "Warp"
    }

    fn is_available(&self) -> bool {
        Self::warp_exe_path().is_some()
    }
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
    fn test_build_uri_simple_path() {
        let uri = WarpLauncher::build_uri("C:/Users/USERNAME/Documents/project");
        assert_eq!(uri, "warp://action/new_window?path=C%3A%2FUsers%2FUSERNAME%2FDocuments%2Fproject");
    }

    #[test]
    fn test_build_uri_path_with_spaces() {
        let uri = WarpLauncher::build_uri("C:/Users/USERNAME/My Documents/project");
        assert!(uri.starts_with("warp://action/new_window?path="));
        assert!(uri.contains("My%20Documents"));
        assert!(!uri.contains(' '));
    }

    #[test]
    fn test_build_uri_windows_backslash_path() {
        let uri = WarpLauncher::build_uri("C:\\Users\\USERNAME\\Documents\\project");
        assert!(uri.starts_with("warp://action/new_window?path="));
        // Backslashes should be URL-encoded
        assert!(uri.contains("%5C") || uri.contains("%5c"));
    }

    #[test]
    fn test_build_launch_config_yaml_uses_forward_slashes() {
        let yaml = WarpLauncher::build_launch_config_yaml(
            "C:\\Users\\USERNAME\\Documents\\project",
            "claude -r abc123",
        );
        // Pitfall 5: YAML cwd must use forward slashes
        assert!(yaml.contains("C:/Users/USERNAME/Documents/project"));
        assert!(!yaml.contains("C:\\Users\\USERNAME"));
    }

    #[test]
    fn test_build_launch_config_yaml_contains_command() {
        let yaml = WarpLauncher::build_launch_config_yaml(
            "C:/Users/USERNAME/project",
            "claude -r session-id-123",
        );
        assert!(yaml.contains("claude -r session-id-123"));
        assert!(yaml.contains("workspace-resume-session"));
        assert!(yaml.contains("Claude Session"));
    }

    #[test]
    fn test_build_launch_config_yaml_has_required_structure() {
        let yaml = WarpLauncher::build_launch_config_yaml("C:/test", "echo hello");
        assert!(yaml.contains("name:"));
        assert!(yaml.contains("windows:"));
        assert!(yaml.contains("tabs:"));
        assert!(yaml.contains("layout:"));
        assert!(yaml.contains("cwd:"));
        assert!(yaml.contains("commands:"));
        assert!(yaml.contains("exec:"));
    }

    #[test]
    fn test_warp_launcher_name() {
        let launcher = WarpLauncher::new();
        assert_eq!(launcher.name(), "Warp");
    }

    #[test]
    fn test_is_available_returns_bool() {
        let launcher = WarpLauncher::new();
        // Should return true or false without panicking
        let _available = launcher.is_available();
    }

    #[test]
    fn test_is_alive_invalid_pid() {
        let launcher = WarpLauncher::new();
        // PID 0 should not be alive (or at least not crash)
        let _alive = launcher.is_alive(0);
    }
}
