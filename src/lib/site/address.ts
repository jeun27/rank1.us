import { isIP } from "node:net";

// Loopback, private, link-local, CGNAT, multicast and reserved ranges (v4 and v6, including v4-mapped
// in dotted or hex form and NAT64).
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) return privateV4(ip.split(".").map(Number));
  const h = expandV6(ip);
  if (!h) return true;
  if (h.slice(0, 5).every((x) => x === 0) && h[5] === 0xffff) return privateV4(v4Of(h));
  if (h[0] === 0x64 && h[1] === 0xff9b) return true;
  return (
    h.every((x) => x === 0) ||
    (h.slice(0, 7).every((x) => x === 0) && h[7] === 1) ||
    (h[0] & 0xfe00) === 0xfc00 ||
    (h[0] & 0xffc0) === 0xfe80 ||
    (h[0] & 0xff00) === 0xff00 ||
    (h[0] === 0x2001 && h[1] === 0xdb8)
  );
}

function privateV4([a, b, c]: number[]): boolean {
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

const v4Of = (h: number[]) => [h[6] >> 8, h[6] & 0xff, h[7] >> 8, h[7] & 0xff];

// Eight 16-bit groups, or null if it isn't valid IPv6. A dotted v4 tail counts as the last two groups.
function expandV6(ip: string): number[] | null {
  let s = ip
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/%.*$/, "");
  if (isIP(s) !== 6) return null;
  const tail = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (tail) {
    const [a, b, c, d] = tail[1].split(".").map(Number);
    s = s.slice(0, -tail[1].length) + `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head, rest] = s.split("::");
  const left = head ? head.split(":") : [];
  const right = rest !== undefined && rest ? rest.split(":") : [];
  const fill = rest === undefined ? [] : Array(8 - left.length - right.length).fill("0");
  const groups = [...left, ...fill, ...right].map((g) => parseInt(g, 16));
  return groups.length === 8 && groups.every((g) => g >= 0 && g <= 0xffff) ? groups : null;
}
