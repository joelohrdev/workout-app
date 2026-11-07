// Generates PWA icons into public/. Run: node scripts/make-icons.mjs
import { writeFile } from "node:fs/promises";
import { createElement as h } from "react";
import { ImageResponse } from "next/og.js";

const BG = "#0b0c0e";
const VOLT = "#d4ff3a";

function mark(size, pad) {
  const s = size * (1 - pad * 2);
  const bar = s * 0.09;
  const plate = (w, hgt) =>
    h("div", { style: { width: w, height: hgt, background: VOLT, borderRadius: s * 0.03 } });
  return h(
    "div",
    {
      style: {
        width: size,
        height: size,
        background: BG,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: s * 0.035,
      },
    },
    plate(s * 0.1, s * 0.42),
    plate(s * 0.12, s * 0.6),
    h("div", { style: { width: s * 0.36, height: bar, background: VOLT, borderRadius: bar / 2 } }),
    plate(s * 0.12, s * 0.6),
    plate(s * 0.1, s * 0.42),
  );
}

const targets = [
  ["icon-192.png", 192, 0.12],
  ["icon-512.png", 512, 0.12],
  ["icon-maskable-512.png", 512, 0.22],
  ["apple-touch-icon.png", 180, 0.14],
];

for (const [name, size, pad] of targets) {
  const res = new ImageResponse(mark(size, pad), { width: size, height: size });
  await writeFile(new URL(`../public/${name}`, import.meta.url), Buffer.from(await res.arrayBuffer()));
  console.log("wrote", name);
}
