use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PanePreset {
    pub name: String,
    pub layout: String,
    pub pane_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaneAssignment {
    pub pane_index: u32,
    pub encoded_project: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pane_preset_serialize_round_trip() {
        let preset = PanePreset {
            name: "dev-layout".to_string(),
            layout: "main-vertical".to_string(),
            pane_count: 3,
        };
        let json = serde_json::to_string(&preset).unwrap();
        let deserialized: PanePreset = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.name, "dev-layout");
        assert_eq!(deserialized.layout, "main-vertical");
        assert_eq!(deserialized.pane_count, 3);
    }

    #[test]
    fn test_pane_preset_all_layouts() {
        let layouts = [
            "even-horizontal",
            "even-vertical",
            "main-horizontal",
            "main-vertical",
            "tiled",
        ];
        for layout in layouts {
            let preset = PanePreset {
                name: "test".to_string(),
                layout: layout.to_string(),
                pane_count: 2,
            };
            let json = serde_json::to_string(&preset).unwrap();
            let deserialized: PanePreset = serde_json::from_str(&json).unwrap();
            assert_eq!(deserialized.layout, layout);
        }
    }

    #[test]
    fn test_pane_assignment_with_project() {
        let assignment = PaneAssignment {
            pane_index: 0,
            encoded_project: Some("C--Users-USERNAME-project".to_string()),
        };
        let json = serde_json::to_string(&assignment).unwrap();
        let deserialized: PaneAssignment = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.pane_index, 0);
        assert_eq!(
            deserialized.encoded_project,
            Some("C--Users-USERNAME-project".to_string())
        );
    }

    #[test]
    fn test_pane_assignment_without_project() {
        let assignment = PaneAssignment {
            pane_index: 1,
            encoded_project: None,
        };
        let json = serde_json::to_string(&assignment).unwrap();
        let deserialized: PaneAssignment = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.pane_index, 1);
        assert_eq!(deserialized.encoded_project, None);
    }

    #[test]
    fn test_pane_assignment_from_json_with_null() {
        let json = r#"{"pane_index":2,"encoded_project":null}"#;
        let assignment: PaneAssignment = serde_json::from_str(json).unwrap();
        assert_eq!(assignment.pane_index, 2);
        assert_eq!(assignment.encoded_project, None);
    }
}
