import { constants, inflateSync } from "node:zlib";

const hex = (h: string) => Buffer.from(h.replace(/\s/g, ""), "hex").toString("latin1");

// Every string a react-pdf file draws or stores: the raw file (metadata), the inflated content streams,
// and each text-show operation decoded (TJ arrays split words into kerned hex chunks, so join them).
export function pdfText(pdf: Uint8Array): string {
  const buf = Buffer.from(pdf);
  const raw = buf.toString("latin1");
  const streams: string[] = [];
  let at = 0;
  for (;;) {
    const start = raw.indexOf("stream\n", at);
    if (start < 0) break;
    const body = start + "stream\n".length;
    const end = raw.indexOf("endstream", body);
    if (end < 0) break;
    try {
      streams.push(inflateSync(buf.subarray(body, end), { finishFlush: constants.Z_SYNC_FLUSH }).toString("latin1"));
    } catch {
      // Not a Flate stream (e.g. an image): its bytes are already in `raw`.
    }
    at = end + "endstream".length;
  }
  const shown = streams.flatMap((s) => [
    ...[...s.matchAll(/\[((?:[^\]]|\\\])*)\]\s*TJ/g)].map((m) =>
      [...m[1].matchAll(/<([0-9a-fA-F\s]*)>|\(((?:\\.|[^\\)])*)\)/g)]
        .map((p) => (p[1] !== undefined ? hex(p[1]) : p[2]))
        .join(""),
    ),
    ...[...s.matchAll(/<([0-9a-fA-F\s]+)>\s*Tj/g)].map((m) => hex(m[1])),
    ...[...s.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)].map((m) => m[1]),
  ]);
  return [raw, ...streams, ...shown].join("\n");
}
