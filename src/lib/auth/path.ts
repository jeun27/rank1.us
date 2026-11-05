// The path the router may end up serving, for access checks: each segment percent-decoded (repeatedly, so
// %252F counts too), split again on decoded slashes, empty and "." segments dropped, ".." resolved, and
// lowercased. Returns null for malformed encoding, which the proxy answers with a 404.
export function normalizePath(pathname: string): string | null {
  let segs = pathname.split("/");
  for (let round = 0; round < 3; round++) {
    let changed = false;
    const next: string[] = [];
    for (const s of segs) {
      let d: string;
      try {
        d = decodeURIComponent(s);
      } catch {
        return null;
      }
      if (d !== s) changed = true;
      next.push(...d.split(/[/\\]/));
    }
    segs = next;
    if (!changed) break;
  }
  const out: string[] = [];
  for (const s of segs) {
    if (s === "" || s === ".") continue;
    if (s === "..") out.pop();
    else out.push(s.toLowerCase());
  }
  return `/${out.join("/")}`;
}
