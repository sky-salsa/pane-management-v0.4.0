import { createSignal, For, Show } from "solid-js";
import { LazyStore } from "@tauri-apps/plugin-store";
import { useApp } from "../../contexts/AppContext";
import {
  setupPaneGrid,
  setPaneAssignment,
  listTmuxPanes,
  listTmuxSessions,
  createSession,
  createWindow,
  sendToPane,
  getPaneAssignmentsRaw,
  renameWindow,
} from "../../lib/tauri-commands";
import { toWslPath } from "../../lib/path";

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
      // Persist layout geometry for resurrect
      const store = new LazyStore("settings.json");
      const layouts = await store.get<Record<string, { cols: number; rows: number }>>("window_layouts") || {};
      layouts[`${sess}|${win}`] = { cols, rows };
      await store.set("window_layouts", layouts);
      await store.save();
      // Only clear assignments for pane indices beyond the new grid size.
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

  /** Gate layout changes that would remove panes with assignments or active processes. */
  function handleLayoutClick(cols: number, rows: number) {
    const newCount = cols * rows;
    const current = currentPaneCount();
    // Not actually reducing, or already at this size — proceed directly
    if (newCount >= current) {
      setGrid(cols, rows);
      return;
    }
    // Reducing panes — check if any pane that would be removed has an assignment or active process
    const hasActiveClaude = state.tmuxPanes.some(
      (p) => p.current_command.toLowerCase().includes("claude"),
    );
    const hasAssignments = Object.keys(state.paneAssignments).length > 0;
    if (hasActiveClaude || hasAssignments) {
      setPendingGrid({ cols, rows });
      return;
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
              // Read saved assignments from our own store (not tmux-resurrect)
              const allAssignments = await getPaneAssignmentsRaw();

              // Group by session+window (skip legacy bare-index keys)
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

              if (groups.size === 0) {
                console.warn("[Resurrect] No saved assignments found");
                return;
              }

              // Determine unique sessions and their windows (sorted)
              const sessionWindows = new Map<string, number[]>();
              for (const group of groups.values()) {
                if (!sessionWindows.has(group.sess)) sessionWindows.set(group.sess, []);
                sessionWindows.get(group.sess)!.push(group.win);
              }
              for (const wins of sessionWindows.values()) wins.sort((a, b) => a - b);

              // Load persisted window names and layout geometry
              const store = new LazyStore("settings.json");
              const windowNames = await store.get<Record<string, string>>("window_names") || {};
              const windowLayouts = await store.get<Record<string, { cols: number; rows: number }>>("window_layouts") || {};

              // Check existing sessions to avoid duplicates
              const existingSessions = new Set((await listTmuxSessions()).map((s) => s.name));

              // Create sessions and windows
              for (const [sessName, windowIndices] of sessionWindows.entries()) {
                if (!existingSessions.has(sessName)) {
                  await createSession(sessName);
                  console.log(`[Resurrect] Created session: ${sessName}`);
                }
                // Session creation gives us the first window. Create additional windows.
                const maxWin = Math.max(...windowIndices);
                for (let w = 2; w <= maxWin; w++) {
                  await createWindow(sessName);
                  console.log(`[Resurrect] Created window ${w} in ${sessName}`);
                }

                // Restore window names
                for (const winIdx of windowIndices) {
                  const savedName = windowNames[`${sessName}|${winIdx}`];
                  if (savedName) {
                    try {
                      await renameWindow(sessName, winIdx, savedName);
                      console.log(`[Resurrect] Renamed ${sessName}:${winIdx} → "${savedName}"`);
                    } catch (_) {}
                  }
                }

                // Set up pane grids (using persisted geometry or default 3x2)
                for (const winIdx of windowIndices) {
                  const layout = windowLayouts[`${sessName}|${winIdx}`] || { cols: 3, rows: 2 };
                  const newPanes = await setupPaneGrid(sessName, winIdx, layout.cols, layout.rows);
                  console.log(`[Resurrect] Set up ${layout.cols}x${layout.rows} grid in ${sessName}:${winIdx} — ${newPanes.length} panes`);

                  // Sort new panes by visual position (top, then left)
                  const sortedPanes = [...newPanes].sort((a, b) => a.top !== b.top ? a.top - b.top : a.left - b.left);

                  // Get saved assignments for this window
                  const group = groups.get(`${sessName}|${winIdx}`);
                  if (!group) continue;

                  // Sort saved pane indices to get visual order (1→pos0, 2→pos1, ..., 6→pos5)
                  for (const { idx: savedIdx, project: encodedProject } of group.panes) {
                    const project = state.projects.find((p) => p.encoded_name === encodedProject);
                    if (!project) {
                      console.warn(`[Resurrect] Project not found: ${encodedProject}, skipping`);
                      continue;
                    }

                    // Map saved index to visual position (1-based → 0-based)
                    const visualPos = savedIdx - 1;
                    if (visualPos < 0 || visualPos >= sortedPanes.length) {
                      console.warn(`[Resurrect] Pane index ${savedIdx} out of range for ${sessName}:${winIdx}`);
                      continue;
                    }

                    const actualPaneIndex = sortedPanes[visualPos].pane_index;
                    const wslPath = toWslPath(project.actual_path);

                    // cd to project directory (NO claude launch)
                    await sendToPane(sessName, winIdx, actualPaneIndex, `cd "${wslPath}"`);
                    await setPaneAssignment(sessName, winIdx, actualPaneIndex, encodedProject);
                    console.log(`[Resurrect] ${sessName}:${winIdx}.${actualPaneIndex} → ${project.actual_path.split(/[\\/]/).pop()}`);
                  }
                }
              }

              refreshTmuxState();
              console.log("[Resurrect] Workspace rebuilt. Resume Claude sessions manually.");
            } catch (e) {
              console.error("[PanePresetPicker] resurrect rebuild error:", e);
            } finally {
              setBusy(false);
            }
          }}
          title="Rebuild workspace from saved pane assignments (cd only, no Claude launch)"
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
