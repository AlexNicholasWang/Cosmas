/**
 * Base URL prefix for API calls. In dev, leave VITE_API_BASE unset and the
 * Vite proxy forwards /api → http://localhost:8000 automatically. In prod
 * (Vercel), set VITE_API_BASE=https://your-render-backend.onrender.com.
 */
const RAW = import.meta.env.VITE_API_BASE ?? "";
// Strip trailing slash so callers can use `${API_BASE}/api/...` cleanly.
export const API_BASE = RAW.replace(/\/$/, "");

/** Convenience: prefix a path that already starts with `/api/...`. */
export function apiUrl(path) {
  return `${API_BASE}${path}`;
}
export async function submitPrompt(userData, vertical) {
  const response = await fetch(apiUrl("/api/prompt"), {
    method: 'POST',
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userData: typeof userData === "object" ? JSON.stringify(userData) : userData, 
      vertical: vertical
    }),
  });
   
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      response.status === 404
        ? "Gemini prompt endpoint missing. Run the backend on port 8000 with the latest code."
        : `Bad response from server (${response.status}).`
    );
  }
  if (!response.ok) {
    const detail = data?.detail;
    let message;
    if (typeof detail === "string") message = detail;
    else if (Array.isArray(detail)) {
      message = detail.map((x) => x?.msg || x).filter(Boolean).join("; ");
    }
    throw new Error(message || data?.message || "Something went wrong. Please try again");
  }
  return data;
}
