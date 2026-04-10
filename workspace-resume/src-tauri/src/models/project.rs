use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct ProjectInfo {
    pub encoded_name: String,
    pub actual_path: String,
    pub session_count: usize,
    pub path_exists: bool,
}
