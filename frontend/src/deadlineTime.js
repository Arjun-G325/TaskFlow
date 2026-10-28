const IST_OFFSET_MINUTES = 330;

function dateTimeParts(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value || "");
  return match ? match.slice(1).map((part) => Number(part || 0)) : null;
}

export function dateTimeInputToUtc(value, timezone) {
  const parts = dateTimeParts(value);
  if (!parts) return null;
  const [year, month, day, hour, minute, second] = parts;
  const wallTimeAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const utcMilliseconds = wallTimeAsUtc - (timezone === "Asia/Kolkata" ? IST_OFFSET_MINUTES * 60_000 : 0);
  return new Date(utcMilliseconds).toISOString();
}

export function utcDateTimeToInput(value, timezone) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const wallTime = new Date(date.getTime() + (timezone === "Asia/Kolkata" ? IST_OFFSET_MINUTES * 60_000 : 0));
  return [
    wallTime.getUTCFullYear(),
    String(wallTime.getUTCMonth() + 1).padStart(2, "0"),
    String(wallTime.getUTCDate()).padStart(2, "0"),
  ].join("-") + `T${String(wallTime.getUTCHours()).padStart(2, "0")}:${String(wallTime.getUTCMinutes()).padStart(2, "0")}`;
}

export function convertDateTimeInput(value, fromTimezone, toTimezone) {
  const instant = dateTimeInputToUtc(value, fromTimezone);
  return instant ? utcDateTimeToInput(instant, toTimezone) : value;
}

export function formatTaskDeadline(task) {
  if (!task?.due_at) return "";
  const timezone = task.due_timezone === "Asia/Kolkata" ? "Asia/Kolkata" : "UTC";
  const label = timezone === "Asia/Kolkata" ? "IST" : "UTC";
  const formatted = new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(task.due_at));
  return `${formatted} ${label}`;
}

export function taskDeadlineTone(task, now = Date.now()) {
  if (!task?.due_at || task.status === "done") return "";
  const deadline = Date.parse(task.due_at);
  if (!Number.isFinite(deadline)) return "";
  if (deadline < now) return "task-title-overdue";
  if (deadline <= now + 24 * 60 * 60 * 1000) return "task-title-due-soon";
  return "";
}
