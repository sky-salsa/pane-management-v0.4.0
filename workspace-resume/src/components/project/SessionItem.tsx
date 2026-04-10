import { createSignal, Show } from "solid-js";
import { useApp } from "../../contexts/AppContext";
import { setSessionBinding, deleteSession } from "../../lib/tauri-commands";
import { relativeTime, formatDuration } from "../../lib/time";
import { launchToPane } from "../../lib/launch";
import type { SessionInfo, ProjectWithMeta } from "../../lib/types";

function truncate(s: string | null, max: number): string {
  if (!s) return "";
  return s.length > max ? s.slice(0, max) + "..." : s;
}

export function SessionItem(props: {
  session: SessionInfo;
  project: ProjectWithMeta;
}) {
  const { state, refreshTmuxState, refreshProjects, isProjectActive } = useApp();
  const [launching, setLaunching] = createSignal(false);
  const [binding, setBinding] = createSignal(false);
  const [confirmDelete, setConfirmDelete] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const isActive = () => isProjectActive(props.project.encoded_name);

  const isBound = () =>
    props.project.meta.bound_session === props.session.session_id;

  // -- Resume (pane-first launch via setPaneAssignment + sendToPane) -------

  async function handleResume() {
    setError(null);

    const tmuxSession = state.selectedTmuxSession;
    const tmuxWindow = state.selectedTmuxWindow;
    if (!tmuxSession || tmuxWindow == null) {
      setError("Select a tmux session first");
      return;
    }

    setLaunching(true);
    try {
      await launchToPane({
        tmuxSession,
        tmuxWindow,
        tmuxPanes: state.tmuxPanes,
        paneAssignments: state.paneAssignments,
        encodedProject: props.project.encoded_name,
        projectPath: props.project.actual_path,
        sessionId: props.session.session_id, // Explicit session override
      });
      refreshTmuxState();
      refreshProjects();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLaunching(false);
    }
  }

  // -- Delete session -------------------------------------------------------

  async function handleDelete() {
    try {
      await deleteSession(props.project.encoded_name, props.session.session_id);
      setConfirmDelete(false);
      refreshProjects();
    } catch (e) {
      console.error("[SessionItem] delete error:", e);
      setError(e instanceof Error ? e.message : String(e));
      setConfirmDelete(false);
    }
  }

  // -- Bind / Unbind -------------------------------------------------------

  async function handleBind() {
    setBinding(true);
    try {
      const newSessionId = isBound() ? null : props.session.session_id;
      await setSessionBinding(props.project.encoded_name, newSessionId);
      refreshProjects();
    } catch (e) {
      console.error("[SessionItem] bind error:", e);
    } finally {
      setBinding(false);
    }
  }

  return (
    <div class="session-item">
      <div class="session-item-header">
        <span class="session-item-id">
          {props.session.session_id.slice(0, 8)}
        </span>
        <Show when={isActive()}>
          <span class="active-dot" title="Running" />
        </Show>
        <Show when={props.session.is_corrupted}>
          <span class="badge corrupted">[CORRUPTED]</span>
        </Show>
      </div>

      <div class="session-item-meta">
        <span>{relativeTime(props.session.last_timestamp)}</span>
        <span>
          {formatDuration(
            props.session.first_timestamp,
            props.session.last_timestamp,
          )}
        </span>
      </div>

      <Show when={props.session.last_user_message}>
        <div class="session-item-message">
          {truncate(props.session.last_user_message, 60)}
        </div>
      </Show>

      <Show when={error()}>
        <div class="error" style={{ "font-size": "0.72rem", margin: "2px 0" }}>
          {error()}
        </div>
      </Show>

      <div class="session-item-actions">
        <button
          class={`resume-btn ${launching() ? "loading" : ""}`}
          disabled={props.session.is_corrupted || launching()}
          onClick={handleResume}
        >
          {launching() ? "Launching..." : "Resume"}
        </button>
        <button
          class={`bind-btn ${isBound() ? "bound" : ""}`}
          disabled={binding()}
          onClick={handleBind}
        >
          {isBound() ? "Unbind" : "Use this"}
        </button>
        <button
          class="delete-btn"
          onClick={() => setConfirmDelete(true)}
          title="Delete this session"
        >
          Delete
        </button>
      </div>

      {/* Delete confirmation modal */}
      <Show when={confirmDelete()}>
        <div class="modal-backdrop" onClick={() => setConfirmDelete(false)}>
          <div class="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <p class="confirm-message">
              Delete session <strong>{props.session.session_id.slice(0, 8)}...</strong>?
            </p>
            <p class="confirm-warning">
              This permanently deletes the session transcript and any subagent data. This cannot be undone.
            </p>
            <div class="confirm-actions">
              <button class="modal-btn" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
              <button class="modal-btn danger" onClick={handleDelete}>
                Delete Session
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
