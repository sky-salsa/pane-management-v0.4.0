import { createSignal, For, Show, createMemo } from "solid-js";
import { createDroppable, useDragDropContext } from "@thisbeyond/solid-dnd";
import { useApp } from "../../contexts/AppContext";
import { ProjectCard } from "../project/ProjectCard";
import { NewProjectFlow } from "../project/NewProjectFlow";
import type { ProjectTier, ProjectWithMeta } from "../../lib/types";

type FilterOption = "all" | ProjectTier;

const FILTER_OPTIONS: { value: FilterOption; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "pinned", label: "Pinned" },
  { value: "paused", label: "Paused" },
  { value: "archived", label: "Archived" },
];

function deriveName(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts[parts.length - 1] || path;
}

export function Sidebar(props: { width?: number }) {
  const { state, projectsByTier } = useApp();
  const [filter, setFilter] = createSignal<FilterOption>("active");
  const [searchText, setSearchText] = createSignal("");
  const [collapsed, setCollapsed] = createSignal(false);
  const [showNewProject, setShowNewProject] = createSignal(false);

  const unpinDroppable = createDroppable("sidebar-unpin");
  const dndContext = useDragDropContext();
  const isDragging = () => dndContext?.[0]?.active?.draggable != null;
  /** Only show the unpin overlay when dragging a pinned pill, not a sidebar card. */
  const isDraggingPin = () => {
    const id = dndContext?.[0]?.active?.draggable?.id;
    return typeof id === "string" && id.startsWith("pin:");
  };

  /** Projects filtered by tier and search text. */
  const filteredProjects = createMemo((): ProjectWithMeta[] => {
    const f = filter();
    let projects: ProjectWithMeta[];
    if (f === "all") {
      projects = state.projects;
    } else {
      projects = projectsByTier(f);
    }

    const search = searchText().toLowerCase().trim();
    if (!search) return projects;

    return projects.filter((p) => {
      const displayName = (p.meta.display_name || "").toLowerCase();
      const folderName = deriveName(p.actual_path).toLowerCase();
      const path = p.actual_path.toLowerCase();
      return displayName.includes(search) || folderName.includes(search) || path.includes(search);
    });
  });

  /** Count for the currently selected filter + search. */
  const filterCount = () => filteredProjects().length;

  return (
    <aside
      class={`sidebar ${collapsed() ? "collapsed" : ""}`}
      style={!collapsed() && props.width ? { width: `${props.width}px`, "min-width": `${props.width}px` } : undefined}
    >
      {/* Collapse toggle */}
      <button
        class="sidebar-toggle"
        onClick={() => setCollapsed((v) => !v)}
        title={collapsed() ? "Expand sidebar" : "Collapse sidebar"}
      >
        <span class="sidebar-toggle-default">{collapsed() ? "\u25B6" : "\u25C0"}</span>
        {/* Neon chevrons — visible only in neon-shinjuku theme via CSS */}
        <span class="sidebar-toggle-neon">
          <svg viewBox="0 0 72 10" fill="none" width="72" height="10">
            {/* 9 chevrons with right-to-left stagger: rightmost (i=8) fires first */}
            <path class="neon-chevron" style={{"animation-delay": "0.48s"}} d={collapsed() ? "M2 1 L6 5 L2 9" : "M6 1 L2 5 L6 9"} stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
            <path class="neon-chevron" style={{"animation-delay": "0.42s"}} d={collapsed() ? "M10 1 L14 5 L10 9" : "M14 1 L10 5 L14 9"} stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
            <path class="neon-chevron" style={{"animation-delay": "0.36s"}} d={collapsed() ? "M18 1 L22 5 L18 9" : "M22 1 L18 5 L22 9"} stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
            <path class="neon-chevron" style={{"animation-delay": "0.30s"}} d={collapsed() ? "M26 1 L30 5 L26 9" : "M30 1 L26 5 L30 9"} stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
            <path class="neon-chevron" style={{"animation-delay": "0.24s"}} d={collapsed() ? "M34 1 L38 5 L34 9" : "M38 1 L34 5 L38 9"} stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
            <path class="neon-chevron" style={{"animation-delay": "0.18s"}} d={collapsed() ? "M42 1 L46 5 L42 9" : "M46 1 L42 5 L46 9"} stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
            <path class="neon-chevron" style={{"animation-delay": "0.12s"}} d={collapsed() ? "M50 1 L54 5 L50 9" : "M54 1 L50 5 L54 9"} stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
            <path class="neon-chevron" style={{"animation-delay": "0.06s"}} d={collapsed() ? "M58 1 L62 5 L58 9" : "M62 1 L58 5 L62 9"} stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
            <path class="neon-chevron" style={{"animation-delay": "0s"}} d={collapsed() ? "M66 1 L70 5 L66 9" : "M70 1 L66 5 L70 9"} stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
          </svg>
        </span>
      </button>

      <Show when={!collapsed()}>
        {/* Search */}
        <div class="sidebar-search">
          <input
            class="sidebar-search-input"
            type="text"
            placeholder="Search projects..."
            value={searchText()}
            onInput={(e) => setSearchText(e.currentTarget.value)}
          />
          <Show when={searchText()}>
            <button
              class="sidebar-search-clear"
              onClick={() => setSearchText("")}
              title="Clear search"
            >
              {"\u2715"}
            </button>
          </Show>
        </div>

        {/* Filter header */}
        <div class="sidebar-filter-header">
          <select
            class="sidebar-filter-select"
            value={filter()}
            onChange={(e) => setFilter(e.currentTarget.value as FilterOption)}
          >
            <For each={FILTER_OPTIONS}>
              {(opt) => {
                const count = () =>
                  opt.value === "all"
                    ? state.projects.length
                    : projectsByTier(opt.value).length;
                return (
                  <option value={opt.value}>
                    {opt.label} ({count()})
                  </option>
                );
              }}
            </For>
          </select>
          <button
            class="new-project-btn"
            onClick={() => setShowNewProject((v) => !v)}
            title="Add a new project from any folder"
          >
            + New
          </button>
        </div>

        {/* New project flow */}
        <Show when={showNewProject()}>
          <NewProjectFlow onCancel={() => setShowNewProject(false)} />
        </Show>

        {/* Project list */}
        <div class="sidebar-project-list" style={{ position: "relative" }}>
          {/* Unpin droppable — always mounted so solid-dnd can register it.
               Only visible when dragging a pinned pill. */}
          <div
            ref={(el) => unpinDroppable(el)}
            class={`sidebar-unpin-overlay ${unpinDroppable.isActiveDroppable ? "drop-active" : ""}`}
            style={{ display: isDraggingPin() ? "flex" : "none" }}
          >
            Drag here to unpin
          </div>
          {/* Drag hint — hidden during drag */}
          <Show when={filteredProjects().length > 0 && !isDragging()}>
            <div class="sidebar-drag-hint">Drag to load in pane</div>
          </Show>
          <Show
            when={filteredProjects().length > 0}
            fallback={
              <div class="sidebar-empty">
                No {filter() === "all" ? "" : filter()} projects found
              </div>
            }
          >
            <For each={filteredProjects()}>
              {(project) => <ProjectCard project={project} />}
            </For>
          </Show>
        </div>
      </Show>
    </aside>
  );
}
