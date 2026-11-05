// Sends a form's fields as JSON. Network failures come back as status 0.
export async function postForm(url: string, form: HTMLFormElement): Promise<{ status: number; errors: string[] }> {
  const body = Object.fromEntries(new FormData(form));
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, errors: Array.isArray(json.errors) ? json.errors : [] };
  } catch {
    return { status: 0, errors: [] };
  }
}
