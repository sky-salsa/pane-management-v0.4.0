import { createSignal, createMemo, For, Show, onMount, onCleanup } from "solid-js";
import {
  createSortable,
  createDroppable,
  SortableProvider,
  transformStyle,
  useDragDropContext,
} from "@thisbeyond/solid-dnd";
import { useApp } from "../../contexts/AppContext";
import { setProjectTier, sendToPane } from "../../lib/tauri-commands";
import { deriveName, fromWslPath } from "../../lib/path";
import type { ProjectWithMeta } from "../../lib/types";

/** Prefix for pin-bar draggable IDs to avoid collisions with sidebar cards. */
export const PIN_PREFIX = "pin:";

function PinnedPill(props: {
  project: ProjectWithMeta;
  onContextMenu: (e: MouseEvent, project: ProjectWithMeta) => void;
}) {
  const { state, isProjectActiveInSession, isProjectWaitingInSession, findProjectWindow, selectTmuxWindow } = useApp();
  const [hovered, setHovered] = createSignal(false);

  const sortable = createSortable(`${PIN_PREFIX}${props.project.encoded_name}`);

  const name = () =>
    props.project.meta.display_name || deriveName(props.project.actual_path);

  const isActive = () => isProjectActiveInSession(props.project.encoded_name);
  const isWaiting = () => isProjectWaitingInSession(props.project.encoded_name);

  const dotClass = () => {
    if (isWaiting()) return "window-status-dot waiting";
    if (isActive()) return "window-status-dot active";
    return "";
  };

  /** Find the waiting pane for this project — returns [windowIndex, paneIndex] or null. */
  function findWaitingPane(): [number, number] | null {
    const proj = state.projects.find((p) => p.encoded_name === props.project.encoded_name);
    if (!proj) return null;
    const actualLower = proj.actual_path.toLowerCase().replace(/[\\/]+$/, "");
    for (const [winIdx, status] of Object.entries(state.windowStatuses)) {
      const paths = status.active_paths ?? [];
      const panes = status.active_panes ?? [];
      const waiting = status.waiting_panes ?? [];
      for (let i = 0; i < paths.length; i++) {
        const pathLower = paths[i].toLowerCase().replace(/\/+$/, "");
        const pathMatch = actualLower === pathLower || actualLower === fromWslPath(paths[i]).toLowerCase().replace(/[\\/]+$/, "");
        if (pathMatch && waiting.includes(panes[i])) {
          return [Number(winIdx), panes[i]];
        }
      }
    }
    return null;
  }

  let clickTimer: ReturnType<typeof setTimeout> | null = null;

  function handleClick(e: MouseEvent) {
    if (sortable.isActiveDraggable) return;
    e.stopPropagation();

    if (clickTimer) {
      // Double-click — approve (send "1") if waiting
      clearTimeout(clickTimer);
      clickTimer = null;
      const wp = findWaitingPane();
      if (wp && state.selectedTmuxSession) {
        // Send just Enter — Claude's selection prompt accepts Enter to confirm
        // the currently highlighted option (❯ defaults to option 1)
        sendToPane(state.selectedTmuxSession, wp[0], wp[1], "").catch(console.error);
      }
    } else {
      // Single-click — navigate (instant, but with short window for double-click)
      const winIdx = findProjectWindow(props.project.encoded_name);
      if (winIdx != null) selectTmuxWindow(winIdx);
      clickTimer = setTimeout(() => { clickTimer = null; }, 300);
    }
  }

  return (
    <button
      ref={(el) => sortable(el)}
      class={`quick-launch-btn ${sortable.isActiveDraggable ? "dragging" : ""} ${hovered() ? "pill-hovered" : ""}`}
      style={transformStyle(sortable.transform)}
      title={`Click to focus${isWaiting() ? " · Double-click to approve" : ""} · Right-click for options · Drag to assign`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
      onContextMenu={(e) => props.onContextMenu(e, props.project)}
    >
      <Show when={dotClass()}>
        <span class={dotClass()} />
      </Show>
      {name()}
    </button>
  );
}

export function QuickLaunch() {
  const { state, projectsByTier, openProjectSettings, refreshProjects } = useApp();
  const [barHovered, setBarHovered] = createSignal(false);

  const pinDroppable = createDroppable("quick-launch-pin");
  const unpinDroppable = createDroppable("quick-launch-unpin");

  const dndContext = useDragDropContext();
  const isDragging = () => dndContext?.[0]?.active?.draggable != null;

  const pinned = () => projectsByTier("pinned");

  /** Pinned projects sorted by stored order. */
  const orderedPinned = createMemo(() => {
    const projects = [...pinned()];
    const order = state.pinnedOrder;
    if (order.length === 0) return projects;
    const orderMap = new Map(order.map((name, i) => [name, i]));
    return projects.sort((a, b) => {
      const ai = orderMap.get(a.encoded_name) ?? Infinity;
      const bi = orderMap.get(b.encoded_name) ?? Infinity;
      return ai - bi;
    });
  });

  const pinnedIds = createMemo(() =>
    orderedPinned().map((p) => PIN_PREFIX + p.encoded_name),
  );

  // Right-click context menu
  const [contextMenu, setContextMenu] = createSignal<{
    x: number;
    y: number;
    project: ProjectWithMeta;
  } | null>(null);

  function showContextMenu(e: MouseEvent, project: ProjectWithMeta) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, project });
  }

  function closeContextMenu() {
    setContextMenu(null);
  }

  async function handleUnpin(project: ProjectWithMeta) {
    closeContextMenu();
    await setProjectTier(project.encoded_name, "active");
    refreshProjects();
  }

  onMount(() => document.addEventListener("click", closeContextMenu));
  onCleanup(() => document.removeEventListener("click", closeContextMenu));

  return (
    <div
      class="quick-launch-container"
      onMouseEnter={() => setBarHovered(true)}
      onMouseLeave={() => setBarHovered(false)}
    >
      {/* Hint text — above the pin bar, doesn't push layout */}
      <div class={`quick-launch-hint ${barHovered() && !isDragging() && pinned().length > 0 ? "visible" : ""}`}>
        Click to focus · Right-click for options · Drag to assign
      </div>

      <div
        ref={(el) => pinDroppable(el)}
        class="quick-launch"
        classList={{ "drop-active": pinDroppable.isActiveDroppable }}
      >
        <Show
          when={pinned().length > 0}
          fallback={<span class="quick-launch-empty">Drop projects here to pin them</span>}
        >
          <SortableProvider ids={pinnedIds()}>
            <For each={orderedPinned()}>
              {(project) => <PinnedPill project={project} onContextMenu={showContextMenu} />}
            </For>
          </SortableProvider>
        </Show>
      </div>

      {/* Pill context menu */}
      <Show when={contextMenu()}>
        <div
          class="tab-context-menu"
          style={{ left: `${contextMenu()!.x}px`, top: `${contextMenu()!.y}px` }}
        >
          <button class="tab-context-item" onClick={() => { openProjectSettings(contextMenu()!.project); closeContextMenu(); }}>
            Settings
          </button>
          <button class="tab-context-item" onClick={() => handleUnpin(contextMenu()!.project)}>
            Unpin
          </button>
        </div>
      </Show>

      {/* Unpin zone — hidden here, rendered in Sidebar instead */}
      <div
        ref={(el) => unpinDroppable(el)}
        style={{ display: "none" }}
      />
    </div>
  );
}
