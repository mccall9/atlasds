// Read-only requests, with bounded retries for transient Google failures.
export async function readSheets(url: string, headers: Record<string, string>) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(url, { headers });
    if (response.ok) return response.json();
    const body = await response.text();
    console.error(`Google Sheets [${response.status}]: ${body}`);
    if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
      const retryAfter = response.headers.get("Retry-After");
      const seconds = retryAfter ? Number(retryAfter) : NaN;
      const dateDelay = retryAfter ? Date.parse(retryAfter) - Date.now() : NaN;
      const delay = Number.isFinite(seconds) ? seconds * 1000 : Number.isFinite(dateDelay) ? dateDelay : response.status === 429 ? 65_000 : 2_000;
      await new Promise((resolve) => setTimeout(resolve, Math.min(120_000, Math.max(1000, delay))));
      continue;
    }
    throw new Error(`Google Sheets [${response.status}]: ${body}`);
  }
  throw new Error("Não foi possível ler o Google Sheets");
}