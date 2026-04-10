use crate::models::project::ProjectInfo;
use crate::models::session::SessionInfo;
use crate::services::path_decoder;
use crate::services::scanner;

#[tauri::command]
pub async fn list_projects() -> Result<Vec<ProjectInfo>, String> {
    let projects_dir = dirs::home_dir()
        .ok_or("Cannot find home directory")?
        .join(".claude")
        .join("projects");

    if !projects_dir.exists() {
        return Ok(vec![]);
    }

    let mut projects = Vec::new();

    let entries = std::fs::read_dir(&projects_dir)
        .map_err(|e| format!("Cannot read projects directory: {}", e))?;

    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(e) => {
                eprintln!("Warning: skipping unreadable directory entry: {}", e);
                continue;
            }
        };

        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let encoded_name = entry.file_name().to_string_lossy().to_string();

        // Only discover WSL-encoded paths (-mnt-c- prefix).
        // Windows-encoded paths (C-- prefix) stay on disk but are hidden from the UI.
        // This avoids duplicates after session migration from Windows to WSL.
        if !encoded_name.starts_with("-mnt-c-") {
            continue;
        }

        // Count .jsonl files and find the most recently modified one
        let mut session_count = 0usize;
        let mut latest_modified = std::time::SystemTime::UNIX_EPOCH;
        if let Ok(rd) = std::fs::read_dir(&path) {
            for e in rd.flatten() {
                let p = e.path();
                if p.is_file() && p.extension().map(|ext| ext == "jsonl").unwrap_or(false) {
                    session_count += 1;
                    if let Ok(meta) = p.metadata() {
                        if let Ok(modified) = meta.modified() {
                            if modified > latest_modified {
                                latest_modified = modified;
                            }
                        }
                    }
                }
            }
        }

        // Get actual path from cwd field in first JSONL record
        let actual_path = path_decoder::extract_cwd_from_first_record(&path)
            .unwrap_or_else(|| {
                // Fallback: use encoded name as-is with a note
                format!("[unresolved] {}", encoded_name)
            });

        // Per locked decision: missing folders still returned, frontend prompts user
        let path_exists = std::path::Path::new(&actual_path).exists();

        projects.push((ProjectInfo {
            encoded_name,
            actual_path,
            session_count,
            path_exists,
        }, latest_modified));
    }

    // Sort by most recently modified session file (newest first)
    projects.sort_by(|a, b| b.1.cmp(&a.1));
    let projects: Vec<ProjectInfo> = projects.into_iter().map(|(p, _)| p).collect();

    Ok(projects)
}

#[tauri::command]
pub async fn list_sessions(encoded_project: String) -> Result<Vec<SessionInfo>, String> {
    let project_dir = dirs::home_dir()
        .ok_or("Cannot find home directory")?
        .join(".claude")
        .join("projects")
        .join(&encoded_project);

    if !project_dir.exists() {
        return Err(format!("Project directory not found: {}", encoded_project));
    }

    let mut sessions = Vec::new();

    let entries = std::fs::read_dir(&project_dir)
        .map_err(|e| format!("Cannot read project directory: {}", e))?;

    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(e) => {
                eprintln!("Warning: skipping unreadable entry: {}", e);
                continue;
            }
        };

        let path = entry.path();

        // Only process .jsonl files that are actual files (not directories)
        if !path.is_file() || path.extension().map(|e| e != "jsonl").unwrap_or(true) {
            continue;
        }

        let session_id = path
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let file_size_bytes = std::fs::metadata(&path)
            .map(|m| m.len())
            .unwrap_or(0);

        // Per locked decision: corrupted sessions shown with warning, never skipped
        match scanner::parse_session_metadata(&path) {
            Ok(meta) => {
                sessions.push(SessionInfo {
                    session_id,
                    first_timestamp: meta.first_timestamp,
                    last_timestamp: meta.last_timestamp,
                    last_user_message: meta.last_user_message,
                    is_corrupted: meta.is_corrupted,
                    file_size_bytes,
                });
            }
            Err(e) => {
                eprintln!("Warning: failed to parse session {}: {}", session_id, e);
                sessions.push(SessionInfo {
                    session_id,
                    first_timestamp: None,
                    last_timestamp: None,
                    last_user_message: None,
                    is_corrupted: true,
                    file_size_bytes,
                });
            }
        }
    }

    // Sort by last_timestamp descending (most recent first)
    // Sessions with no timestamp sort to the end
    sessions.sort_by(|a, b| {
        match (&b.last_timestamp, &a.last_timestamp) {
            (Some(b_ts), Some(a_ts)) => b_ts.cmp(a_ts),
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
            (None, None) => std::cmp::Ordering::Equal,
        }
    });

    Ok(sessions)
}

#[tauri::command]
pub async fn delete_session(encoded_project: String, session_id: String) -> Result<(), String> {
    let project_dir = dirs::home_dir()
        .ok_or("Cannot find home directory")?
        .join(".claude")
        .join("projects")
        .join(&encoded_project);

    let session_file = project_dir.join(format!("{}.jsonl", session_id));
    if !session_file.exists() {
        return Err(format!("Session file not found: {}", session_id));
    }

    std::fs::remove_file(&session_file)
        .map_err(|e| format!("Failed to delete session: {}", e))?;

    // Also remove the session subdirectory (subagent transcripts) if it exists
    let session_dir = project_dir.join(&session_id);
    if session_dir.is_dir() {
        let _ = std::fs::remove_dir_all(&session_dir);
    }

    Ok(())
}

#[tauri::command]
pub async fn check_continuity_exists(path: String) -> Result<bool, String> {
    // Convert WSL path to Windows if needed (Rust runs on Windows, not WSL)
    let win_path = if path.starts_with("/mnt/") {
        let rest = &path[5..]; // strip "/mnt/"
        if rest.len() >= 2 && rest.as_bytes()[1] == b'/' {
            let drive = rest.as_bytes()[0].to_ascii_uppercase() as char;
            format!("{}:{}", drive, rest[1..].replace('/', "\\"))
        } else {
            path.clone()
        }
    } else {
        path.clone()
    };
    let base = std::path::Path::new(&win_path);
    Ok(base.join(".continuity").is_dir() || base.join("active-planning-files").is_dir())
}

#[tauri::command]
pub async fn open_directory(path: String) -> Result<(), String> {
    open::that(&path).map_err(|e| format!("Failed to open directory: {}", e))
}

/// Get the filesystem inode for a directory path.
/// Runs via WSL, so uses Unix inode. The actual path may be on NTFS
/// (via /mnt/c/) but WSL exposes a stable inode for NTFS files.
/// Returns None if the path doesn't exist.
#[tauri::command]
pub async fn get_inode(path: String) -> Result<Option<u64>, String> {
    // The Rust binary runs on Windows, but the paths we're checking are
    // WSL paths accessed via wsl.exe. Use a WSL stat call to get the inode.
    let script = format!("stat -c '%i' '{}' 2>/dev/null || echo 'NOTFOUND'", path.replace('\'', "'\\''"));

    let mut cmd = std::process::Command::new("wsl.exe");
    cmd.args(["-e", "bash", "-c", &script]);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = cmd.output()
        .map_err(|e| format!("Failed to run stat via WSL: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout == "NOTFOUND" || stdout.is_empty() {
        return Ok(None);
    }

    match stdout.parse::<u64>() {
        Ok(inode) => Ok(Some(inode)),
        Err(_) => Ok(None),
    }
}

/// Search for a directory with a specific inode within a root directory tree.
/// Uses WSL `find` + `stat` for efficiency. Bounded by max_depth.
/// Returns the WSL path if found, None if not.
#[tauri::command]
pub async fn find_inode_in_tree(
    root: String,
    target_inode: u64,
    max_depth: u32,
) -> Result<Option<String>, String> {
    // Use find to enumerate directories, stat each one, compare inodes
    let script = format!(
        "find '{}' -maxdepth {} -type d -exec stat -c '%i %n' {{}} \\; 2>/dev/null | grep '^{} ' | head -1 | cut -d' ' -f2-",
        root.replace('\'', "'\\''"),
        max_depth,
        target_inode
    );

    let mut cmd = std::process::Command::new("wsl.exe");
    cmd.args(["-e", "bash", "-c", &script]);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }

    let output = cmd.output()
        .map_err(|e| format!("Failed to search via WSL: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout.is_empty() {
        Ok(None)
    } else {
        Ok(Some(stdout))
    }
}

/// DEV-ONLY: Hard exit so the dev loop script relaunches the app.
/// Remove before production builds.
#[tauri::command]
pub async fn dev_restart() {
    std::process::exit(0);
}
