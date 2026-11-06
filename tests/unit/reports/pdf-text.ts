import { constants, inflateSync } from "node:zlib";

const hex = (h: string) => Buffer.from(h.replace(/\s/g, ""), "hex").toString("latin1");

// Every string a react-pdf file draws or stores: the raw file (metadata), the inflated streams, and the
// drawn text. Embedded fonts (Inter) draw glyph ids, so each run is decoded with its font's ToUnicode
// CMap (Tf -> /Font resource -> /ToUnicode stream), and a stream's runs are joined in drawing order.
export function pdfText(pdf: Uint8Array): string {
  const buf = Buffer.from(pdf);
  const raw = buf.toString("latin1");
  const streams = new Map<string, string>(); // object number -> inflated stream
  let at = 0;
  for (;;) {
    const start = raw.indexOf("stream\n", at);
    if (start < 0) break;
    const body = start + "stream\n".length;
    const end = raw.indexOf("endstream", body);
    if (end < 0) break;
    const obj = [...raw.slice(0, start).matchAll(/(\d+) 0 obj/g)].at(-1)?.[1] ?? `#${start}`;
    try {
      streams.set(
        obj,
        inflateSync(buf.subarray(body, end), { finishFlush: constants.Z_SYNC_FLUSH }).toString("latin1"),
      );
    } catch {
      // Not a Flate stream (e.g. an image): its bytes are already in `raw`.
    }
    at = end + "endstream".length;
  }

  const utf16 = (h: string) => Buffer.from(h, "hex").swap16().toString("utf16le");
  const cmap = (s: string) => {
    const map = new Map<string, string>();
    for (const block of s.matchAll(/beginbfchar([\s\S]*?)endbfchar/g))
      for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g))
        map.set(m[1].toLowerCase(), utf16(m[2]));
    for (const block of s.matchAll(/beginbfrange([\s\S]*?)endbfrange/g))
      for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*\[([^\]]*)\]/g))
        [...m[3].matchAll(/<([0-9a-fA-F]+)>/g)].forEach((t, k) =>
          map.set((parseInt(m[1], 16) + k).toString(16).padStart(m[1].length, "0"), utf16(t[1])),
        );
    return map;
  };
  const object = (n: string) => raw.match(new RegExp(`(?:^|\\n)${n} 0 obj([\\s\\S]*?)endobj`))?.[1] ?? "";
  // Font resource name (/F2) -> its ToUnicode map. Every page here shares one resource dictionary.
  const fonts = new Map<string, Map<string, string>>();
  for (const dict of raw.matchAll(/\/Font\s*<<([^>]*)>>/g))
    for (const [, name, ref] of dict[1].matchAll(/\/(\S+)\s+(\d+) 0 R/g)) {
      const toUnicode = object(ref).match(/\/ToUnicode (\d+) 0 R/)?.[1];
      const s = toUnicode && streams.get(toUnicode);
      if (s) fonts.set(name, cmap(s));
    }

  const decode = (h: string, map: Map<string, string> | undefined) => {
    const clean = h.replace(/\s/g, "").toLowerCase();
    if (!map) return hex(clean);
    return (clean.match(/.{4}/g) ?? []).map((c) => map.get(c) ?? "").join("");
  };
  const op = /\/(\S+)\s+[\d.]+\s+Tf|\[((?:[^\]]|\\\])*)\]\s*TJ|<([0-9a-fA-F\s]+)>\s*Tj|\(((?:\\.|[^\\)])*)\)\s*Tj/g;
  const part = /<([0-9a-fA-F\s]*)>|\(((?:\\.|[^\\)])*)\)/g;
  const shown = [...streams.values()].flatMap((s) => {
    let font: Map<string, string> | undefined;
    const runs: string[] = [];
    for (const m of s.matchAll(op)) {
      if (m[1] !== undefined) font = fonts.get(m[1]);
      else if (m[2] !== undefined)
        runs.push([...m[2].matchAll(part)].map((p) => (p[1] !== undefined ? decode(p[1], font) : p[2])).join(""));
      else runs.push(m[3] !== undefined ? decode(m[3], font) : m[4]);
    }
    return runs.length ? [...runs, runs.join("")] : [];
  });
  return [raw, ...streams.values(), ...shown].join("\n");
}
