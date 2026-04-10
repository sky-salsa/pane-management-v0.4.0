use notify::{Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::HashSet;
use tauri::Emitter;
use tokio::sync::mpsc;
use tokio::time::{Duration, Instant};

/// Start a file watcher on ~/.claude/projects/ that emits "session-changed"
/// Tauri events whenever .jsonl files are created or modified.
///
/// Events are debounced: changes are collected for 3 seconds of quiet before
/// a batch is emitted. This prevents event floods during active Claude sessions.
///
/// The returned watcher handle MUST be kept alive (not dropped) or watching stops.
pub async fn start_watcher(
    app_handle: tauri::AppHandle,
) -> Result<RecommendedWatcher, String> {
    let (tx, mut rx) = mpsc::channel::<Event>(256);

    let mut watcher = RecommendedWatcher::new(
        move |res: Result<Event, notify::Error>| {
            if let Ok(event) = res {
                let _ = tx.blocking_send(event);
            }
        },
        notify::Config::default(),
    )
    .map_err(|e| format!("Failed to create watcher: {}", e))?;

    let claude_projects = dirs::home_dir()
        .ok_or("Cannot find home directory")?
        .join(".claude")
        .join("projects");

    if claude_projects.exists() {
        watcher
            .watch(&claude_projects, RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to watch directory: {}", e))?;
    } else {
        eprintln!(
            "Warning: {:?} does not exist, watcher has nothing to watch",
            claude_projects
        );
    }

    // Debounced event processing task
    tokio::spawn(async move {
        let mut pending: HashSet<String> = HashSet::new();
        let mut last_event = Instant::now();
        let debounce_duration = Duration::from_secs(3);

        loop {
            tokio::select! {
                event = rx.recv() => {
                    match event {
                        Some(e) => {
                            for path in &e.paths {
                                if path.extension().map(|ext| ext == "jsonl").unwrap_or(false) {
                                    pending.insert(path.to_string_lossy().to_string());
                                }
                            }
                            last_event = Instant::now();
                        }
                        None => break, // Channel closed, watcher was dropped
                    }
                }
                _ = tokio::time::sleep(Duration::from_millis(500)) => {
                    if !pending.is_empty() && last_event.elapsed() >= debounce_duration {
                        let paths: Vec<String> = pending.drain().collect();
                        if let Err(e) = app_handle.emit("session-changed", &paths) {
                            eprintln!("Failed to emit session-changed event: {}", e);
                        }
                    }
                }
            }
        }
    });

    Ok(watcher)
}
