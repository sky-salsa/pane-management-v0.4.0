export function relativeTime(isoTimestamp: string | null): string {
  if (!isoTimestamp) return "unknown";
  const now = Date.now();
  const then = new Date(isoTimestamp).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return "just now";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(isoTimestamp).toLocaleDateString();
}

export function formatDuration(firstTimestamp: string | null, lastTimestamp: string | null): string {
  if (!firstTimestamp || !lastTimestamp) return "-";
  const ms = new Date(lastTimestamp).getTime() - new Date(firstTimestamp).getTime();
  if (ms < 0) return "-";
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return "<1m";
}
