import { createMemo, For, Show } from "solid-js";
import { useApp } from "../../contexts/AppContext";
import { PaneSlot } from "./PaneSlot";
import type { TmuxPane } from "../../lib/types";

/**
 * Compute inline grid style STRING based on pane count and geometry.
 * Uses a raw string (not an object) to guarantee the browser receives
 * the exact CSS we intend — avoids any SolidJS style-object edge cases.
 */
function gridStyleString(panes: TmuxPane[]): string {
  const count = panes.length;
  if (count <= 1) {
    return "display:grid; grid-template-columns:1fr; grid-template-rows:1fr;";
  }
  if (count === 2) {
    const sameTop = panes[0].top === panes[1].top;
    return sameTop
      ? "display:grid; grid-template-columns:1fr 1fr; grid-template-rows:1fr;"
      : "display:grid; grid-template-columns:1fr; grid-template-rows:1fr 1fr;";
  }
  if (count === 3 || count === 4) {
    return "display:grid; grid-template-columns:1fr 1fr; grid-template-rows:1fr 1fr;";
  }
  // 5+ panes: 3 columns, rows as needed
  const rows = Math.ceil(count / 3);
  const rowStr = Array(rows).fill("1fr").join(" ");
  return `display:grid; grid-template-columns:1fr 1fr 1fr; grid-template-rows:${rowStr};`;
}

export function PaneGrid() {
  const { state } = useApp();

  const hasSession = () => state.selectedTmuxSession != null;
  const hasWindow = () => state.selectedTmuxWindow != null;
  const hasPanes = () => state.tmuxPanes.length > 0;
  const sortedPanes = createMemo(() =>
    [...state.tmuxPanes].sort((a, b) => a.top - b.top || a.left - b.left),
  );

  return (
    <Show
      when={hasSession() && hasWindow()}
      fallback={
        <div class="pane-grid-empty">
          Select a tmux session and window above, then drag projects here
        </div>
      }
    >
      <Show
        when={hasPanes()}
        fallback={
          <div class="pane-grid-empty">No panes in this window</div>
        }
      >
        <div
          class="pane-grid"
          style={gridStyleString(state.tmuxPanes)}
          title={`${state.tmuxPanes.length} panes`}
        >
          <For each={sortedPanes()}>
            {(pane) => (
              <PaneSlot
                pane={pane}
                assignment={state.paneAssignments[pane.pane_index.toString()] ?? null}
              />
            )}
          </For>
        </div>
      </Show>
    </Show>
  );
}
