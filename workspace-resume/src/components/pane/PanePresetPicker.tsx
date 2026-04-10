import { createSignal, For, Show } from "solid-js";
import { useApp } from "../../contexts/AppContext";
import {
  setupPaneGrid,
  setPaneAssignment,
  tmuxResurrectRestore,
  listTmuxPanes,
} from "../../lib/tauri-commands";
import { launchToPane } from "../../lib/launch";

/** Fixed layout presets with dot-grid icons. */
const FIXED_LAYOUTS = [
  { label: "1", cols: 1, rows: 1, dots: [[1]] },
  { label: "2", cols: 2, rows: 1, dots: [[1, 1]] },
  { label: "3", cols: 3, rows: 1, dots: [[1, 1, 1]] },
  { label: "4", cols: 2, rows: 2, dots: [[1, 1], [1, 1]] },
  { label: "6", cols: 3, rows: 2, dots: [[1, 1, 1], [1, 1, 1]] },
] as const;

function DotGrid(props: { dots: readonly (readonly number[])[] }) {
  return (
    <span class="layout-dot-grid">
      {props.dots.map((row) => (
        <span class="layout-dot-row">
          {row.map(() => <span class="layout-dot" />)}
        </span>
      ))}
    </span>
  );
}

export function PanePresetPicker() {
  const { state, refreshTmuxState } = useApp();

  const [busy, setBusy] = createSignal(false);
  const [showSnapshotModal, setShowSnapshotModal] = createSignal(false);
  const [pendingGrid, setPendingGrid] = createSignal<{ cols: number; rows: number } | null>(null);

  const session = () => state.selectedTmuxSession;
  const window = () => state.selectedTmuxWindow;
  const currentPaneCount = () => state.tmuxPanes.length;

  /**
   * Set up a pane grid with the given columns x rows.
   * Uses a single tmux script that creates columns first, then splits
   * each column vertically — producing the correct widescreen layout.
   */
  async function setGrid(cols: number, rows: number) {
    const sess = session();
    const win = window();
    if (sess == null || win == null) return;

    setBusy(true);
    try {
      const newPaneCount = cols * rows;
      await setupPaneGrid(sess, win, cols, rows);
      // Only clear assignments for pane indices beyond the new grid size.
      // New grids get sequential indices starting from 0, so any old
      // assignment with index >= newPaneCount is stale.
      const staleKeys = Object.keys(state.paneAssignments).filter(
        (idx) => Number(idx) >= newPaneCount,
      );
      if (staleKeys.length > 0) {
        await Promise.all(staleKeys.map((idx) => setPaneAssignment(sess, win, Number(idx), null)));
      }
      refreshTmuxState();
    } catch (e) {
      console.error("[PanePresetPicker] setGrid error:", e);
    } finally {
      setBusy(false);
    }
  }

  /** Gate layout changes that reduce pane count while Claude sessions are active. */
  function handleLayoutClick(cols: number, rows: number) {
    const newCount = cols * rows;
    if (newCount < currentPaneCount()) {
      // Check if any pane has an active Claude session
      const hasActiveClaude = state.tmuxPanes.some(
        (p) => p.current_command.toLowerCase().includes("claude"),
      );
      if (hasActiveClaude) {
        setPendingGrid({ cols, rows });
        return;
      }
    }
    setGrid(cols, rows);
  }

  return (
    <div class="preset-picker">
      {/* Fixed layout buttons */}
      <div class="preset-picker-row">
        <span class="preset-picker-label">Layout:</span>
        <For each={FIXED_LAYOUTS}>
          {(item) => (
            <button
              class={`preset-btn ${currentPaneCount() === item.cols * item.rows ? "preset-active" : ""}`}
              disabled={busy()}
              onClick={() => handleLayoutClick(item.cols, item.rows)}
              title={`${item.cols * item.rows} pane${item.cols * item.rows > 1 ? "s" : ""} (${item.cols}\u00d7${item.rows})`}
            >
              <DotGrid dots={item.dots} /> {item.label}
            </button>
          )}
        </For>
      </div>

      {/* Resurrect + snapshot */}
      <div class="preset-picker-row">
        <button
          class="preset-btn resurrect"
          disabled={busy()}
          onClick={async () => {
            setBusy(true);
            try {
              await tmuxResurrectRestore();
              refreshTmuxState();

              // Wait for tmux to finish restoring panes
              await new Promise((r) => setTimeout(r, 2000));

              // Re-launch Claude sessions across ALL sessions+windows from saved assignments
              // Keys are "session|window|pane" format — get all from the raw store
              const { getPaneAssignmentsRaw } = await import("../../lib/tauri-commands");
              const allAssignments = await getPaneAssignmentsRaw();

              // Group by session+window
              const groups = new Map<string, { sess: string; win: number; panes: { idx: number; project: string }[] }>();
              for (const [key, encodedProject] of Object.entries(allAssignments)) {
                const parts = key.split("|");
                if (parts.length !== 3) continue;
                const [sessName, winStr, paneStr] = parts;
                const groupKey = `${sessName}|${winStr}`;
                if (!groups.has(groupKey)) {
                  groups.set(groupKey, { sess: sessName, win: Number(winStr), panes: [] });
                }
                groups.get(groupKey)!.panes.push({ idx: Number(paneStr), project: encodedProject });
              }

              // Launch in each session+window
              for (const group of groups.values()) {
                let panes;
                try {
                  panes = await listTmuxPanes(group.sess, group.win);
                } catch (e) {
                  console.warn(`[Resurrect] window ${group.sess}:${group.win} not found, skipping`);
                  continue;
                }
                for (const { idx: paneIndex, project: encodedProject } of group.panes) {
                  const project = state.projects.find((p) => p.encoded_name === encodedProject);
                  if (!project) continue;
                  const paneExists = panes.some((p) => p.pane_index === paneIndex);
                  if (!paneExists) continue;
                  try {
                    await launchToPane({
                      tmuxSession: group.sess,
                      tmuxWindow: group.win,
                      tmuxPanes: panes,
                      paneAssignments: state.paneAssignments,
                      encodedProject,
                      projectPath: project.actual_path,
                      boundSession: project.meta.bound_session,
                      targetPaneIndex: paneIndex,
                    });
                  } catch (e) {
                    console.error(`[Resurrect] failed to resume pane ${paneIndex} in ${group.sess}:${group.win}:`, e);
                  }
                }
              }
              refreshTmuxState();
            } catch (e) {
              console.error("[PanePresetPicker] resurrect restore error:", e);
            } finally {
              setBusy(false);
            }
          }}
          title="Restore last saved tmux state"
        >
          Resurrect
        </button>

        <span class="preset-picker-divider" />

        <button
          class="preset-btn"
          onClick={() => setShowSnapshotModal(true)}
          title="Save a named workspace snapshot"
        >
          Snapshot
        </button>
      </div>

      {/* Confirm reduce panes modal */}
      <Show when={pendingGrid()}>
        <div class="modal-backdrop" onClick={() => setPendingGrid(null)}>
          <div class="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <p class="confirm-message">
              <strong>Active Claude sessions detected</strong>
            </p>
            <p class="confirm-warning">
              Reducing panes will kill active sessions in removed panes. Better handling for this is planned — this is a safety check to prevent accidental loss.
            </p>
            <div class="confirm-actions">
              <button class="modal-btn" onClick={() => setPendingGrid(null)}>
                Cancel
              </button>
              <button
                class="modal-btn danger"
                onClick={() => {
                  const grid = pendingGrid()!;
                  setPendingGrid(null);
                  setGrid(grid.cols, grid.rows);
                }}
              >
                Reduce Anyway
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Snapshot coming-soon modal */}
      <Show when={showSnapshotModal()}>
        <div class="modal-backdrop" onClick={() => setShowSnapshotModal(false)}>
          <div class="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <p class="confirm-message">
              <strong>Snapshot</strong> is under development.
            </p>
            <p class="confirm-warning">
              This feature will save named workspace snapshots including tmux layout and project assignments. Check the backlog for more details.
            </p>
            <div class="confirm-actions">
              <button class="modal-btn" onClick={() => setShowSnapshotModal(false)}>
                OK
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
