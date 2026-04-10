import { createSignal, Show } from "solid-js";
import { createDraggable } from "@thisbeyond/solid-dnd";
import { useApp } from "../../contexts/AppContext";
import {
  setDisplayName,
  setProjectTier,
  getInode,
  updateProjectInode,
} from "../../lib/tauri-commands";
import { open } from "@tauri-apps/plugin-dialog";
import { launchToPane, newSessionInPane } from "../../lib/launch";
import type { ProjectWithMeta, ProjectTier } from "../../lib/types";

/**
 * Derive a display name from the project's actual path.
 * Shows the last path segment (the folder name).
 */
function deriveName(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts[parts.length - 1] || path;
}

export function ProjectCard(props: { project: ProjectWithMeta }) {
  const { state, refreshProjects, refreshTmuxState, isProjectActive, openProjectSettings, startPanePick } = useApp();

  // Draggable for Plan 04 drop zones
  const draggable = createDraggable(props.project.encoded_name);

  // Local UI state
  const [editing, setEditing] = createSignal(false);
  const [editValue, setEditValue] = createSignal("");
  const [launching, setLaunching] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const displayName = () =>
    props.project.meta.display_name || deriveName(props.project.actual_path);

  const isActive = () => isProjectActive(props.project.encoded_name);

  // -- Inline rename -------------------------------------------------------

  function startRename() {
    setEditValue(displayName());
    setEditing(true);
  }

  async function commitRename() {
    const newName = editValue().trim();
    setEditing(false);
    if (!newName || newName === displayName()) return;
    try {
      await setDisplayName(props.project.encoded_name, newName);
      refreshProjects();
    } catch (e) {
      console.error("[ProjectCard] rename error:", e);
    }
  }

  function cancelRename() {
    setEditing(false);
  }

  function handleNameKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") commitRename();
    if (e.key === "Escape") cancelRename();
  }

  // -- Tier change ---------------------------------------------------------

  async function handleTierChange(e: Event) {
    const newTier = (e.target as HTMLSelectElement).value as ProjectTier;
    try {
      await setProjectTier(props.project.encoded_name, newTier);
      refreshProjects();
    } catch (err) {
      console.error("[ProjectCard] tier change error:", err);
    }
  }

  // -- Resume / New Session -------------------------------------------------
  // If the project is already assigned to a pane, launch directly there.
  // Otherwise, open the pane picker so the user can choose.

  /** Find if this project is already assigned to a pane in the current window. */
  function findAssignedPane(): number | undefined {
    for (const [idx, proj] of Object.entries(state.paneAssignments)) {
      if (proj === props.project.encoded_name) return Number(idx);
    }
    return undefined;
  }

  async function handleResume() {
    setError(null);
    const tmuxSession = state.selectedTmuxSession;
    const tmuxWindow = state.selectedTmuxWindow;
    if (!tmuxSession || tmuxWindow == null) {
      setError("Select a tmux session first");
      return;
    }

    const assignedPane = findAssignedPane();
    if (assignedPane != null) {
      // Already has a pane — launch directly
      setLaunching(true);
      try {
        await launchToPane({
          tmuxSession,
          tmuxWindow,
          tmuxPanes: state.tmuxPanes,
          paneAssignments: state.paneAssignments,
          encodedProject: props.project.encoded_name,
          projectPath: props.project.actual_path,
          boundSession: props.project.meta.bound_session,
          targetPaneIndex: assignedPane,
        });
        refreshTmuxState();
        refreshProjects();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLaunching(false);
      }
    } else {
      // No pane — open picker
      startPanePick({ project: props.project, mode: "resume" });
    }
  }

  async function handleNewSession() {
    setError(null);
    const tmuxSession = state.selectedTmuxSession;
    const tmuxWindow = state.selectedTmuxWindow;
    if (!tmuxSession || tmuxWindow == null) {
      setError("Select a tmux session first");
      return;
    }

    const assignedPane = findAssignedPane();
    if (assignedPane != null) {
      setLaunching(true);
      try {
        await newSessionInPane({
          tmuxSession,
          tmuxWindow,
          tmuxPanes: state.tmuxPanes,
          paneAssignments: state.paneAssignments,
          encodedProject: props.project.encoded_name,
          projectPath: props.project.actual_path,
          targetPaneIndex: assignedPane,
        });
        refreshTmuxState();
        refreshProjects();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLaunching(false);
      }
    } else {
      startPanePick({ project: props.project, mode: "new" });
    }
  }

  return (
    <div
      ref={(el) => draggable(el)}
      class={`project-card ${draggable.isActiveDraggable ? "dragging" : ""}`}
    >
      {/* Header: name + active dot */}
      <div class="project-card-header">
        <Show when={isActive()}>
          <span class="active-dot" title="Active" />
        </Show>

        <Show
          when={!editing()}
          fallback={
            <div class="project-card-name editing">
              <input
                value={editValue()}
                onInput={(e) => setEditValue(e.currentTarget.value)}
                onBlur={commitRename}
                onKeyDown={handleNameKeyDown}
                ref={(el) => setTimeout(() => el.focus(), 0)}
              />
            </div>
          }
        >
          <span
            class="project-card-name"
            onDblClick={startRename}
            title={props.project.actual_path}
          >
            {displayName()}
          </span>
        </Show>
      </div>

      {/* Meta line */}
      <div class="project-card-meta">
        <span>{props.project.session_count} sessions</span>
        <select
          class="tier-select"
          value={props.project.meta.tier}
          onChange={handleTierChange}
          onClick={(e) => e.stopPropagation()}
        >
          <option value="pinned">Pinned</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Error display */}
      <Show when={error()}>
        <div class="error" style={{ "font-size": "0.72rem", margin: "2px 0" }}>
          {error()}
        </div>
      </Show>

      {/* Unlinked state — only show if we have a stored inode AND the inode scan failed
           (meaning we actually confirmed the path is gone, not just that Windows can't check WSL paths) */}
      {/* Unlinked: only when reconciliation explicitly confirmed the path is gone
           (claude_project_dirs is [] empty array, not null/undefined) */}
      <Show when={Array.isArray(props.project.meta.claude_project_dirs) && props.project.meta.claude_project_dirs.length === 0}>
        <div class="project-card-unlinked">
          <span class="unlinked-badge" title="The project directory has been moved or renamed. Use Relink to reconnect to the new location.">Unlinked</span>
          <button
            class="relink-btn"
            onClick={async () => {
              const selected = await open({ directory: true, title: "Relink project — select the new directory" });
              if (selected && typeof selected === "string") {
                const inode = await getInode(selected);
                const existingDirs = props.project.meta.claude_project_dirs ?? [];
                if (!existingDirs.includes(props.project.encoded_name)) {
                  existingDirs.push(props.project.encoded_name);
                }
                await updateProjectInode(props.project.encoded_name, inode, existingDirs);
                refreshProjects();
              }
            }}
          >
            Relink
          </button>
        </div>
      </Show>

      {/* Actions — always show */}
      <div class="project-card-actions">
        <button
          class={`resume-btn ${launching() ? "loading" : ""}`}
          disabled={launching()}
          onClick={handleResume}
        >
          {launching() ? "..." : "Resume"}
        </button>
        <button
          class="new-session-btn"
          disabled={launching()}
          onClick={handleNewSession}
          title="Start fresh Claude session"
        >
          +
        </button>
        <button class="project-settings-btn" onClick={() => openProjectSettings(props.project)}>
          Settings
        </button>
      </div>
    </div>
  );
}
