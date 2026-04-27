// Stable per-user color: hash uuid → HSL.
// Same user always gets the same color, even across devices and offline.

function hash32(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

export function userColor(
  userId: string,
  opts?: { saturation?: number; lightness?: number },
): string {
  const hue = hash32(userId) % 360;
  const sat = opts?.saturation ?? 70;
  const light = opts?.lightness ?? 55;
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

// Mapbox FillLayer / LineLayer expect hex or rgb. Convert.
export function userColorHex(userId: string): string {
  const hue = hash32(userId) % 360;
  return hslToHex(hue, 70, 55);
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const c = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
