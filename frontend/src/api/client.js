const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function formatError(detail) {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => item?.msg || item?.message || JSON.stringify(item)).join("; ");
  }
  if (detail && typeof detail === "object") {
    return detail.message || detail.detail || JSON.stringify(detail);
  }
  return "The request could not be completed.";
}

export async function apiRequest(path, options = {}) {
  const { token, headers = {}, ...fetchOptions } = options;
  const requestHeaders = { "Content-Type": "application/json", ...headers };
  if (token) requestHeaders.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    headers: requestHeaders,
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(formatError(body.detail ?? body.message));
  }
  return body;
}
