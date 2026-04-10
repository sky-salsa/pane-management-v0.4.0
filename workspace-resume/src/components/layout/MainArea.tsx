import { Show } from "solid-js";
import { useDragDropContext } from "@thisbeyond/solid-dnd";
import { useApp } from "../../contexts/AppContext";
import { PaneGrid } from "../pane/PaneGrid";
import { PanePresetPicker } from "../pane/PanePresetPicker";
import { QuickLaunch } from "./QuickLaunch";
import { PIN_PREFIX } from "./QuickLaunch";
import { SESSION_TAB_PREFIX, WINDOW_TAB_PREFIX } from "./TopBar";
import { PANE_SLOT_PREFIX } from "../pane/PaneSlot";
import { NEW_PROJECT_PREFIX, NEW_PROJECT_CONTINUITY_PREFIX } from "../project/NewProjectFlow";

export function MainArea() {
  const { state } = useApp();
  const dndCtx = useDragDropContext();

  const hasSession = () => state.selectedTmuxSession != null;
  const hasWindow = () => state.selectedTmuxWindow != null;

  /** True when dragging a sidebar project card (not a pin, tab, or pane). */
  const isDraggingProject = () => {
    const id = dndCtx?.[0]?.active?.draggable?.id;
    if (!id) return false;
    const sid = String(id);
    return !sid.startsWith(PIN_PREFIX)
      && !sid.startsWith(SESSION_TAB_PREFIX)
      && !sid.startsWith(WINDOW_TAB_PREFIX)
      && !sid.startsWith(PANE_SLOT_PREFIX)
      && !sid.startsWith(NEW_PROJECT_PREFIX)
      && !sid.startsWith(NEW_PROJECT_CONTINUITY_PREFIX);
  };

  return (
    <main class="main-area">
      <div class="main-content">
        {/* Preset toolbar -- only visible when session + window selected */}
        <Show when={hasSession() && hasWindow()}>
          <PanePresetPicker />
        </Show>

        {/* Pane grid visualization */}
        <PaneGrid />

        {/* Drag hints — between pane grid and quick launch */}
        <Show when={isDraggingProject()}>
          <div class="drag-zone-hints">
            <div class="drag-zone-hint">{"\u2191"} Drop on a pane to assign</div>
            <div class="drag-zone-hint">{"\u2193"} Drop below to pin for quick access</div>
          </div>
        </Show>

      </div>

      <QuickLaunch />
    </main>
  );
}
