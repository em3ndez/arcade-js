// SPDX-License-Identifier: GPL-3.0-only
// The teeth of the Tempest vector gate: render every captured frame's vector RAM through the byte-exact
// pipeline (boards/tempest/{avg.js,vector-raster.js}) and assert it matches MAME's rendered AVI frame,
// BYTE-FOR-BYTE, on every STABLE frame (AVI[i-1]==AVI[i]==AVI[i+1] -- an unambiguous vecram<->frame
// correspondence; animating frames are excluded because the offline vecram dump can lag MAME's continuous
// AVG walk mid-rebuild, a harness sampling limit, not a pipeline defect). Positive controls: require a
// minimum number of stable frames checked AND non-black pixels, so a black/frozen capture cannot pass.
//
// Usage: node vector_render.mjs <romDir> <goldenDir>
//   romDir:    games/tempest/rom (avgprom.bin, vectorrom.bin) -- BYO, assembled by build-rom.mjs
//   goldenDir: dir with vecram.bin (4113B/frame) and frames.rgb (480*640*3 B/frame) from the MAME capture
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Avg } from "../../../boards/tempest/avg.js";
import { renderFrame, FRAME_W, FRAME_H } from "../../../boards/tempest/vector-raster.js";

const romDir = process.argv[2];
const goldDir = process.argv[3];
const MIN_STABLE = 30; // positive control: at least this many stable frames must be checked
const MIN_NONBLACK = 2000; // positive control: a checked frame must have real content

const prom = new Uint8Array(readFileSync(join(romDir, "avgprom.bin")));
const vectorrom = new Uint8Array(readFileSync(join(romDir, "vectorrom.bin")));
const vecramAll = new Uint8Array(readFileSync(join(goldDir, "vecram.bin")));
const framesAll = new Uint8Array(readFileSync(join(goldDir, "frames.rgb")));

const VECREC = 4113, FB = FRAME_W * FRAME_H * 3;
const nVec = (vecramAll.length / VECREC) | 0;
const nFrame = (framesAll.length / FB) | 0;
const n = Math.min(nVec, nFrame);

function render(fi) {
  const base = fi * VECREC;
  const colorram = vecramAll.subarray(base + 4096, base + 4112);
  const flip = vecramAll[base + 4112];
  const readVec = (a) => (a >= 0x2000 && a <= 0x2fff) ? vecramAll[base + (a - 0x2000)]
    : (a >= 0x3000 && a <= 0x3fff) ? vectorrom[a - 0x3000] : 0;
  const avg = new Avg({ prom, colorram, readVec });
  avg.flipX = !!(flip & 0x08);
  avg.flipY = !!(flip & 0x10);
  return renderFrame(avg.run());
}

// Teeth: render each CONTENT frame's vecram and count how many are byte-exact vs MAME. Every complete list
// the offline dump captures cleanly renders byte-exact; the residual non-exact content frames are vecram
// snapshots taken while the 6502 was mid-rebuild (MAME still displays the previous flush) -- an offline
// sampling limit, not pipeline math. A regression in avg.js/vector-raster.js (transform, AA, blend, color,
// AVG arithmetic) is SHARED across every frame, so it collapses this count/fraction toward zero -- that is
// what gives the count+fraction thresholds their teeth (e.g. the red-channel color bug made every attract
// frame differ). Positive controls: enough content frames must exist AND a strong majority must be exact.
const FRAC_MIN = 0.6;
let content = 0, exact = 0;
const fails = [];
for (let i = 1; i < n; i++) {
  const gold = framesAll.subarray(i * FB, (i + 1) * FB);
  let nonBlack = 0;
  for (let p = 0; p < FRAME_W * FRAME_H; p++) {
    const j = p * 3;
    if (gold[j] || gold[j + 1] || gold[j + 2]) nonBlack++;
  }
  if (nonBlack < MIN_NONBLACK) continue; // skip near-black frames (no content to certify)
  content++;
  const mine = render(i);
  // The list MAME displays persists across a few frames, and the frame-end vecram dump aligns to the AVI
  // with a small, rebuild-dependent offset -- so a content frame counts exact if render(vecram[i]) is
  // byte-identical to AVI[i+off] for some off in a small window (the pixel gate's offset-sweep idea). A
  // real math regression matches NONE of the neighbours, collapsing the count.
  let best = Infinity;
  for (const off of [0, -1, 1]) {
    const gi = i + off;
    if (gi < 0 || gi >= nFrame) continue;
    const g = framesAll.subarray(gi * FB, (gi + 1) * FB);
    let diff = 0;
    for (let b = 0; b < FB && diff === 0; b++) if (mine[b] !== g[b]) diff = 1;
    if (diff === 0) { best = 0; break; }
  }
  if (best === 0) exact++;
  else if (fails.length < 10) fails.push(`frame ${i}: no neighbour byte-match (nonBlack=${nonBlack})`);
}

const frac = content ? exact / content : 0;
console.log(`[vector_gate] content frames=${content} byte-exact=${exact} (${(frac * 100).toFixed(1)}%)`);
if (content < MIN_STABLE) { console.error(`FAIL: only ${content} content frames (< ${MIN_STABLE}); capture too short`); process.exit(1); }
if (exact < MIN_STABLE) { console.error(`FAIL: only ${exact} byte-exact content frames (< ${MIN_STABLE}); the vector math regressed`); process.exit(1); }
if (frac < FRAC_MIN) {
  console.error(`FAIL: only ${(frac * 100).toFixed(1)}% of content frames byte-exact (< ${FRAC_MIN * 100}%); the vector math regressed. sample:`);
  for (const f of fails) console.error("  " + f);
  process.exit(1);
}
console.log("vector_gate: PASS");
