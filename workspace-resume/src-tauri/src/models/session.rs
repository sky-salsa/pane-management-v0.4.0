use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct SessionInfo {
    pub session_id: String,
    pub first_timestamp: Option<String>,
    pub last_timestamp: Option<String>,
    pub last_user_message: Option<String>,
    pub is_corrupted: bool,
    pub file_size_bytes: u64,
    pub source_dir: Option<String>,
}
