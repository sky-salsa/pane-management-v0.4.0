import { Show, createSignal } from "solid-js";
import { createDraggable, createDroppable } from "@thisbeyond/solid-dnd";
import { useApp } from "../../contexts/AppContext";
import { setPaneAssignment, killPane, cancelPaneCommand, sendToPane, openDirectory } from "../../lib/tauri-commands";
import { launchToPane, newSessionInPane } from "../../lib/launch";
import { deriveName, fromWslPath } from "../../lib/path";
import type { TmuxPane, ProjectWithMeta } from "../../lib/types";

export const PANE_SLOT_PREFIX = "pane-slot:";


interface PaneSlotProps {
  pane: TmuxPane;
  assignment: string | null;
}

export function PaneSlot(props: PaneSlotProps) {
  const { state, refreshTmuxState, refreshProjects, pausePolling, resumePolling, openProjectSettings, pendingLaunch, cancelPanePick, mutePane, unmutePane, isPaneMuted } = useApp();

  // Draggable for pane swapping, droppable for project drops and swap targets
  const draggable = createDraggable(PANE_SLOT_PREFIX + props.pane.pane_index);
  const droppable = createDroppable(props.pane.pane_index.toString());

  /** Look up the explicitly assigned project. */
  const assignedProject = (): ProjectWithMeta | null => {
    if (!props.assignment) return null;
    return state.projects.find((p) => p.encoded_name === props.assignment) ?? null;
  };

  /**
   * Auto-detect project from pane's working directory when there's no
   * explicit assignment. Converts the WSL path to Windows and matches
   * against known projects.
   */
  const detectedProject = (): ProjectWithMeta | null => {
    if (props.assignment) return null; // explicit assignment takes priority
    const panePath = props.pane.current_path;
    if (!panePath) return null;

    // Compare both as WSL and as Windows — actual_path could be either format
    const paneAsWsl = panePath.toLowerCase().replace(/\/+$/, "");
    const paneAsWin = fromWslPath(panePath).toLowerCase().replace(/[\\/]+$/, "");
    return (
      state.projects.find((p) => {
        const actual = p.actual_path.toLowerCase().replace(/[\\/]+$/, "");
        return actual === paneAsWsl || actual === paneAsWin;
      }) ?? null
    );
  };

  /** The effective project — explicit assignment first, auto-detected second. */
  const effectiveProject = () => assignedProject() ?? detectedProject();

  /** Check if the pane is currently running a claude process. */
  const isRunningClaude = () =>
    props.pane.current_command.toLowerCase().includes("claude");

  /** Display name for the effective project. */
  const projectName = () => {
    const proj = effectiveProject();
    if (!proj) return "";
    return proj.meta.display_name || deriveName(proj.actual_path);
  };

  /** Whether this pane's project was auto-detected (not explicitly assigned). */
  const isDetected = () => !props.assignment && detectedProject() != null;

  /** Whether this pane is waiting for approval (from 15s status poll). */
  const isWaitingApproval = () => {
    const winIdx = String(state.selectedTmuxWindow ?? "");
    const status = state.windowStatuses[winIdx];
    return status?.waiting_panes?.includes(props.pane.pane_index) ?? false;
  };

  const [launching, setLaunching] = createSignal(false);
  const [hovered, setHovered] = createSignal(false);
  const [showInfo, setShowInfo] = createSignal(false);
  const [confirmReplace, setConfirmReplace] = createSignal(false);

  /** Whether this pane is muted (suppresses waiting notification at the data level). */
  const isMuted = () => {
    const sess = state.selectedTmuxSession;
    const win = state.selectedTmuxWindow;
    if (!sess || win == null) return false;
    return isPaneMuted(sess, win, props.pane.pane_index);
  };

  function toggleMute() {
    const sess = state.selectedTmuxSession;
    const win = state.selectedTmuxWindow;
    if (!sess || win == null) return;
    if (isMuted()) {
      unmutePane(sess, win, props.pane.pane_index);
    } else {
      mutePane(sess, win, props.pane.pane_index);
    }
  }

  const isPaneSelectMode = () => pendingLaunch() != null;

  /** Whether this pane has something running or assigned (occupied). */
  const isOccupied = () => isRunningClaude() || hasProject();

  /** Execute the pending launch in this pane. */
  async function executePendingLaunch() {
    const pl = pendingLaunch();
    if (!pl) return;
    const sess = state.selectedTmuxSession;
    const win = state.selectedTmuxWindow;
    if (!sess || win == null) return;

    cancelPanePick(); // clears pending + resumes polling
    setLaunching(true);
    try {
      if (pl.mode === "resume") {
        await launchToPane({
          tmuxSession: sess,
          tmuxWindow: win,
          tmuxPanes: state.tmuxPanes,
          paneAssignments: state.paneAssignments,
          encodedProject: pl.project.encoded_name,
          projectPath: pl.project.actual_path,
          boundSession: pl.project.meta.bound_session,
          sessionId: pl.sessionId,
          targetPaneIndex: props.pane.pane_index,
          yolo: pl.yolo,
        });
      } else {
        await newSessionInPane({
          tmuxSession: sess,
          tmuxWindow: win,
          tmuxPanes: state.tmuxPanes,
          paneAssignments: state.paneAssignments,
          encodedProject: pl.project.encoded_name,
          projectPath: pl.project.actual_path,
          targetPaneIndex: props.pane.pane_index,
          yolo: pl.yolo,
        });
      }
      // Handle continuity post-launch
      if (pl.continuity) {
        await new Promise((r) => setTimeout(r, 7000));
        const { sendToPane: send } = await import("../../lib/tauri-commands");
        await send(sess, win, props.pane.pane_index, "/continuity");
      }
      refreshTmuxState();
      refreshProjects();
    } catch (e) {
      console.error("[PaneSlot] pending launch error:", e);
    } finally {
      setLaunching(false);
    }
  }

  /** Handle click in pane-select mode. */
  function handlePaneSelectClick(e: MouseEvent) {
    if (!isPaneSelectMode()) return;
    e.stopPropagation();
    e.preventDefault();
    if (isOccupied()) {
      setConfirmReplace(true);
    } else {
      executePendingLaunch();
    }
  }

  /** Resume Claude in this specific pane. */
  async function handleResume() {
    const sess = state.selectedTmuxSession;
    const win = state.selectedTmuxWindow;
    const proj = effectiveProject();
    if (sess == null || win == null || !proj) return;

    setLaunching(true);
    try {
      await launchToPane({
        tmuxSession: sess,
        tmuxWindow: win,
        tmuxPanes: state.tmuxPanes,
        paneAssignments: state.paneAssignments,
        encodedProject: proj.encoded_name,
        projectPath: proj.actual_path,
        boundSession: proj.meta.bound_session,
        targetPaneIndex: props.pane.pane_index,
      });
      refreshTmuxState();
      refreshProjects();
    } catch (e) {
      console.error("[PaneSlot] resume error:", e);
    } finally {
      setLaunching(false);
    }
  }

  /** Start a fresh Claude session in this pane. */
  async function handleNewSession() {
    const sess = state.selectedTmuxSession;
    const win = state.selectedTmuxWindow;
    const proj = effectiveProject();
    if (sess == null || win == null || !proj) return;

    setLaunching(true);
    try {
      await newSessionInPane({
        tmuxSession: sess,
        tmuxWindow: win,
        tmuxPanes: state.tmuxPanes,
        paneAssignments: state.paneAssignments,
        encodedProject: proj.encoded_name,
        projectPath: proj.actual_path,
        targetPaneIndex: props.pane.pane_index,
      });
      refreshTmuxState();
      refreshProjects();
    } catch (e) {
      console.error("[PaneSlot] new session error:", e);
    } finally {
      setLaunching(false);
    }
  }

  /** Clear: kill any running process, cd home, clear the terminal, remove assignment. */
  async function handleClear() {
    const sess = state.selectedTmuxSession;
    const win = state.selectedTmuxWindow;
    if (sess == null || win == null) return;
    try {
      await setPaneAssignment(sess, win, props.pane.pane_index, null);
      // Ctrl-C twice to kill any running process (e.g. Claude)
      await cancelPaneCommand(sess, win, props.pane.pane_index);
      await new Promise((r) => setTimeout(r, 500));
      await sendToPane(sess, win, props.pane.pane_index, "cd ~ && clear");
      refreshTmuxState();
      refreshProjects();
    } catch (e) {
      console.error("[PaneSlot] clear error:", e);
    }
  }

  /** Claim: create an explicit assignment for an auto-detected project. */
  async function handleClaim() {
    const proj = detectedProject();
    if (!proj) return;
    try {
      const sess = state.selectedTmuxSession;
      const win = state.selectedTmuxWindow;
      if (sess == null || win == null) return;
      await setPaneAssignment(sess, win, props.pane.pane_index, proj.encoded_name);
      refreshTmuxState();
      refreshProjects();
    } catch (e) {
      console.error("[PaneSlot] claim error:", e);
    }
  }

  /** Unassign the project from this pane — cancel any running process first. */
  async function handleUnassign() {
    const sess = state.selectedTmuxSession;
    const win = state.selectedTmuxWindow;
    try {
      // Send Ctrl-C to stop whatever is running (e.g. Claude) so the pane
      // returns to a clean shell prompt before we clear the assignment.
      if (sess != null && win != null) {
        await cancelPaneCommand(sess, win, props.pane.pane_index);
      }
      await setPaneAssignment(sess ?? "", win ?? 0, props.pane.pane_index, null);
      refreshTmuxState();
      refreshProjects();
    } catch (e) {
      console.error("[PaneSlot] unassign error:", e);
    }
  }

  /** Kill this tmux pane and unassign the project. */
  async function handleKillPane() {
    const sess = state.selectedTmuxSession;
    const win = state.selectedTmuxWindow;
    if (sess == null || win == null) return;

    try {
      await setPaneAssignment(sess, win, props.pane.pane_index, null);
      await killPane(sess, win, props.pane.pane_index);
      refreshTmuxState();
      refreshProjects();
    } catch (e) {
      console.error("[PaneSlot] kill pane error:", e);
    }
  }

  /** Whether this pane has any project (assigned or detected). */
  const hasProject = () => effectiveProject() != null;

  return (
    <div
      ref={(el) => { draggable(el); droppable(el); }}
      class={`pane-slot ${props.assignment ? "assigned" : ""} ${isDetected() ? "detected" : ""} ${draggable.isActiveDraggable ? "dragging" : ""} ${isWaitingApproval() ? "waiting-approval" : ""} ${isPaneSelectMode() ? "pane-selectable" : ""}`}
      classList={{ "drop-active": droppable.isActiveDroppable }}
      onClick={(e) => { if (isPaneSelectMode()) handlePaneSelectClick(e); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setConfirmReplace(false); }}
    >
      {/* Pane index badge (becomes info icon on hover) + close button */}
      <div class="pane-slot-top">
        <Show
          when={hovered()}
          fallback={
            <span class="pane-slot-badge" title={`Pane ${props.pane.pane_index}`}>
              {props.pane.pane_index}
            </span>
          }
        >
          <span
            class={`pane-slot-badge info-toggle ${showInfo() ? "active" : ""}`}
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); const next = !showInfo(); setShowInfo(next); if (next) pausePolling(); else resumePolling(); }}
            onPointerDown={(e) => e.stopPropagation()}
            title="Pane info"
          >
            ?
          </span>
        </Show>
      </div>

      {/* Info modal overlay */}
      <Show when={showInfo()}>
        <div class="modal-backdrop" onClick={() => { setShowInfo(false); resumePolling(); }}>
          <div class="confirm-modal pane-info-modal" onClick={(e) => e.stopPropagation()}>
            <div class="pane-info-modal-header">
              <strong>Pane {props.pane.pane_index}</strong>
              <div class="pane-info-header-actions">
                <Show when={props.pane.current_path}>
                  <button
                    class="modal-btn"
                    onClick={() => openDirectory(fromWslPath(props.pane.current_path))}
                  >
                    Open Directory
                  </button>
                </Show>
                <button class="modal-btn" onClick={() => { setShowInfo(false); resumePolling(); }}>{"\u2715"}</button>
              </div>
            </div>
            <div class="pane-info-modal-body">
              <Show when={projectName()}>
                <span class="pane-info-label">Project</span>
                <span class="pane-info-value">{projectName()}</span>
              </Show>
              <Show when={props.pane.current_command && props.pane.current_command !== "-"}>
                <span class="pane-info-label">Command</span>
                <span class="pane-info-value">{props.pane.current_command}</span>
              </Show>
              <Show when={props.pane.current_path}>
                <span class="pane-info-label">Path</span>
                <span class="pane-info-value">{props.pane.current_path}</span>
              </Show>
              <span class="pane-info-label">Pane ID</span>
              <span class="pane-info-value">{props.pane.pane_id}</span>
              <span class="pane-info-label">Size</span>
              <span class="pane-info-value">{props.pane.width} x {props.pane.height}</span>
            </div>
          </div>
        </div>
      </Show>

      {/* Status indicators — top right */}
      <div class="pane-slot-status">
        <Show when={effectiveProject()}>
          <button
            class="pane-slot-settings"
            onClick={(e) => { e.stopPropagation(); openProjectSettings(effectiveProject()!, props.pane.pane_index); }}
            onPointerDown={(e) => e.stopPropagation()}
            title="Project settings"
          >{"\u2699"}</button>
        </Show>
        <Show when={isDetected()}>
          <span class="pane-slot-detected-tag" title="Auto-detected from working directory">detected</span>
        </Show>
        <Show when={isRunningClaude()}>
          <span class="pane-slot-active-indicator" title="Claude running" />
        </Show>
      </div>

      {/* Main content area */}
      <div class="pane-slot-content">
        <Show
          when={hasProject()}
          fallback={
            <Show
              when={isRunningClaude()}
              fallback={
                <div class="pane-slot-placeholder">Drop project here</div>
              }
            >
              <span class="pane-slot-project-name">{deriveName(props.pane.current_path)}</span>
              <div class="pane-slot-pending">Send a message to start</div>
            </Show>
          }
        >
          <span class="pane-slot-project-name">{projectName()}</span>
        </Show>
      </div>

      {/* Action buttons — bottom left */}
      <div class="pane-slot-actions">
        <Show when={isRunningClaude() && !hasProject()}>
          <button class="pane-slot-unassign" onClick={handleClear} title="Stop Claude and reset this pane">Clear</button>
        </Show>
        <Show when={hasProject() && !isRunningClaude() && !isDetected()}>
          <button class="pane-slot-resume" onClick={handleResume} disabled={launching()} title="Resume Claude in this pane">
            {launching() ? "..." : "Resume"}
          </button>
          <button class="pane-slot-new-session" onClick={handleNewSession} disabled={launching()} title="Start fresh Claude session">+</button>
        </Show>
        <Show when={isDetected()}>
          <button class="pane-slot-claim" onClick={handleClaim} title="Assign this project to this pane">Claim</button>
          <button class="pane-slot-unassign" onClick={handleClear} title="Clear project from this pane">Clear</button>
        </Show>
        <Show when={props.assignment}>
          <button class="pane-slot-unassign" onClick={handleUnassign} title="Unassign project (keep pane)">Unassign</button>
        </Show>
        <Show when={effectiveProject()}>
          <button class="pane-slot-open-dir" onClick={() => openDirectory(fromWslPath(effectiveProject()!.actual_path))} title="Open project directory">
            <svg width="14" height="12" viewBox="0 0 16 13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1.5 3V11.5a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H8L6.5 2H2.5a1 1 0 0 0-1 1z" />
              <path d="M1.5 5h13" />
            </svg>
          </button>
        </Show>
      </div>

      {/* Mute notification bell — bottom right, only when waiting */}
      <Show when={isWaitingApproval() || isMuted()}>
        <button
          class={`pane-slot-mute ${isMuted() ? "muted" : ""}`}
          onClick={(e) => { e.stopPropagation(); toggleMute(); }}
          onPointerDown={(e) => e.stopPropagation()}
          title={isMuted() ? "Unmute notifications" : "Mute notifications"}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            <Show when={isMuted()}>
              <line x1="1" y1="1" x2="23" y2="23" stroke-width="2.5" />
            </Show>
          </svg>
        </button>
      </Show>

      {/* Confirm replace in pane-select mode */}
      <Show when={confirmReplace()}>
        <div class="pane-select-confirm" onClick={(e) => e.stopPropagation()}>
          <p>Replace <strong>{projectName()}</strong> in this pane?</p>
          <div class="pane-select-confirm-actions">
            <button class="modal-btn" onClick={(e) => { e.stopPropagation(); setConfirmReplace(false); }}>Cancel</button>
            <button class="modal-btn danger" onClick={(e) => { e.stopPropagation(); setConfirmReplace(false); executePendingLaunch(); }}>Replace</button>
          </div>
        </div>
      </Show>

    </div>
  );
}
