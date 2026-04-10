use std::path::Path;
use std::io::{BufRead, BufReader};
use std::fs::File;

/// Extract the `cwd` field from the first valid JSONL record in a project directory.
/// This is the authoritative source for a project's actual filesystem path.
/// DO NOT attempt to decode the encoded directory name algorithmically -- the encoding is lossy.
pub fn extract_cwd_from_first_record(project_dir: &Path) -> Option<String> {
    let entries = std::fs::read_dir(project_dir).ok()?;
    for entry in entries {
        let entry = entry.ok()?;
        let path = entry.path();
        if path.extension().map(|e| e == "jsonl").unwrap_or(false) && path.is_file() {
            let file = File::open(&path).ok()?;
            let reader = BufReader::new(file);
            // Try the first 10 lines to find a record with cwd
            // (first 2+ lines are often metadata without cwd)
            for line in reader.lines().take(10) {
                if let Ok(line) = line {
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&line) {
                        if let Some(cwd) = val.get("cwd").and_then(|v| v.as_str()) {
                            return Some(cwd.to_string());
                        }
                    }
                }
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn fixtures_dir() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests").join("fixtures")
    }

    #[test]
    fn test_extract_cwd_from_valid_jsonl() {
        let result = extract_cwd_from_first_record(&fixtures_dir());
        assert_eq!(result, Some("C:\\Users\\USERNAME\\Documents\\TestProject".to_string()));
    }

    #[test]
    fn test_extract_cwd_from_empty_dir() {
        let temp = tempfile::tempdir().unwrap();
        let result = extract_cwd_from_first_record(temp.path());
        assert_eq!(result, None);
    }

    #[test]
    fn test_extract_cwd_from_corrupted_json() {
        let temp = tempfile::tempdir().unwrap();
        let bad_file = temp.path().join("bad.jsonl");
        std::fs::write(&bad_file, "{not valid json!!!}").unwrap();
        let result = extract_cwd_from_first_record(temp.path());
        assert_eq!(result, None);
    }
}
