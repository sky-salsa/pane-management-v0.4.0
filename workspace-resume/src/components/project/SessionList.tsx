import { createResource, For, Show } from "solid-js";
import { listSessions } from "../../lib/tauri-commands";
import { SessionItem } from "./SessionItem";
import type { ProjectWithMeta } from "../../lib/types";

export function SessionList(props: { project: ProjectWithMeta }) {
  const [sessions] = createResource(
    () => props.project.encoded_name,
    (enc) => listSessions(enc),
  );

  return (
    <div class="session-list-container">
      <Show when={sessions.loading}>
        <div class="session-list-loading">Loading sessions...</div>
      </Show>

      <Show when={sessions.error}>
        <div class="error" style={{ "font-size": "0.78rem", padding: "8px" }}>
          Error: {String(sessions.error)}
        </div>
      </Show>

      <Show when={!sessions.loading && !sessions.error}>
        <Show
          when={sessions() && sessions()!.length > 0}
          fallback={<div class="session-list-empty">No sessions found</div>}
        >
          <For each={sessions()}>
            {(session) => (
              <SessionItem session={session} project={props.project} />
            )}
          </For>
        </Show>
      </Show>
    </div>
  );
}
