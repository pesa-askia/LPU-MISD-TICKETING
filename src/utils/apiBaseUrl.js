export function getApiBaseUrl() {
  const localUrl = import.meta.env.VITE_API_BASE_URL_LOCAL || "http://localhost:5000";
  const prodUrl = import.meta.env.VITE_API_BASE_URL_PROD || "";

  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1");

  if (isLocalhost) return localUrl;

  // In production, prefer explicit prod URL; otherwise assume same-origin (useful if you proxy)
  return prodUrl || window.location.origin;
}

