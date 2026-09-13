// SPDX-License-Identifier: GPL-3.0-only
// The teeth of the Tempest pixel gate. Renders the IDIOMATIC layer (runIdiomaticIrqGame + the byte-exact
// AVG->raster pipeline) and diffs each MAME golden frame against its NEAREST idiomatic frame -- the
// drift-tolerant reconverge rule (docs/pixel-gate.md), because the clock-free idiomatic layer runs one
// game-update per frame (~26.5Hz) while MAME's AVI is 60Hz, so the timelines warp and a fixed offset breaks.
//
// The attract DEMO is RNG-driven (a hardware POKEY LFSR read directly), which the clock-free layer freezes,
// so it forks without the TESTING-ONLY entropy pin: golden/random.txt is the captured RANDOM read sequence
// per chip (games/tempest/tools/lua/dump_random.lua), replayed into m.io.pokeyRead reg 0x0a. Deterministic
// attract screens are byte-exact WITHOUT the pin; the pin only removes the RNG-fork noise so a real
// vector-logic regression still shows (the pin never touches vector generation).
//
// TEETH: a wrong layer collapses all three metrics. Proven in-run by a NULL-MUTANT (swap R/B on the rendered
// idiomatic frames -- a plausible palette bug) that MUST flip the verdict to FAIL, reusing the same rendered
// frames so it costs only a second diff. A gate whose mutant still "passes" is decoration and exits nonzero.
//
// Usage: node pixel_suite.mjs <romDir> <goldenDir>   (goldenDir: frames.rgb + random.txt from one MAME run)
// Prints "tempest_pixel: OK" only on a clean PASS with the mutant refuted; every cannot-run path exits nonzero.
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { Machine, resolveAllIdiomatic } from "../machine.js";
import { runIdiomaticIrqGame } from "../../../core/frame-stepped.js";
import manifest from "../manifest.js";
import { SCREEN_W, SCREEN_H } from "../../../boards/tempest/video.js";

const FB = SCREEN_W * SCREEN_H * 3;
const romDir = process.argv[2];
const goldDir = process.argv[3];
if (!romDir || !goldDir) { console.error("usage: node pixel_suite.mjs <romDir> <goldenDir>"); process.exit(2); }

// Calibration (measured against an 8s attract golden; normal run 62.4% byte-exact / 99.1% within the 1%
// band / longest above-band run 4; the R/B mutant 0% / 0% / whole-run). Thresholds sit between the two.
const BAND = Math.round(0.01 * (SCREEN_W * SCREEN_H)); // 1% of pixels: a fast demo element 1 tick off drifts within it
const FRAC_EXACT_MIN = 0.40;   // a real vector regression drops this toward 0 (mutant: 0)
const FRAC_BAND_MIN = 0.90;    // isolated drift spikes allowed; a wrong layer leaves ~none within band (mutant: 0)
const MAX_RUN = 10;            // a sustained above-band run = a divergence that never reconverges (mutant: whole run)
const MIN_CONTENT = 200;       // positive control: enough non-black golden frames to certify
const MIN_DISTINCT = 60;       // positive control: the idiomatic render is not frozen/black
const MIN_NONBLACK = 2000;     // a certified golden frame must carry real content
const GOLD_STRIDE = 2;         // check every other golden frame -- dense enough for reconverge, ~2x faster
const SEARCH = 45;             // nearest-frame search half-window around the linear timeline estimate

function loadRom(n) {
  const p = join(romDir, n);
  if (!existsSync(p)) { console.error(`missing ROM image: ${p}`); process.exit(2); }
  return new Uint8Array(readFileSync(p));
}

// Extract the per-chip RANDOM value sequence from the capture ("<chip> <value>" per line).
function loadPin(dir) {
  const txt = readFileSync(join(dir, "random.txt"), "utf8");
  const chip = [[], []];
  for (const line of txt.split("\n")) {
    const s = line.split(" ");
    if (s.length === 2) chip[+s[0] === 0 ? 0 : 1].push(+s[1] & 0xff);
  }
  return chip;
}

const goldPx = new Uint8Array(readFileSync(join(goldDir, "frames.rgb")));
const nGold = (goldPx.length / FB) | 0;
if (nGold < 2) { console.error(`golden has ${nGold} frame(s) -- capture too short`); process.exit(2); }
const pin = loadPin(goldDir);

const irq = manifest.convergence?.idiomatic?.irq;
if (!irq) { console.error("manifest.convergence.idiomatic.irq not declared"); process.exit(2); }

// Render the idiomatic layer with the pin. Cap frames to cover the golden's game-time (~0.44 idio frame per
// golden frame) with headroom, so the pin does not overrun (which would fork the demo past the drain point).
const idioCount = Math.ceil(nGold * 0.45) + 8;
const overrides = await resolveAllIdiomatic();
const machine = new Machine(loadRom("maincpu.bin"), {
  overrides, vectorrom: loadRom("vectorrom.bin"), avgprom: loadRom("avgprom.bin"),
});
const at = [0, 0], over = [0, 0];
const orig = machine.io.pokeyRead.bind(machine.io);
machine.io.pokeyRead = (chip, reg, cycles) => {
  if ((reg & 0x0f) === 0x0a) {
    const c = chip === 0 ? 0 : 1;
    if (at[c] < pin[c].length) return pin[c][at[c]++];
    over[c]++;
    return 0xff;
  }
  return orig(chip, reg, cycles);
};

const idio = [];
const run = runIdiomaticIrqGame(machine, {
  bootAddr: irq.bootAddr, irqVblank: irq.irqVblank, maxFrames: idioCount,
  onFrame: (m, f) => { if (f !== 0) idio.push(m.renderFrame()); },
});
if (run.stopError) { console.error(`idiomatic run stopped: ${run.stopError.message || run.stopError}`); process.exit(1); }
if (over[0] > 8 || over[1] > 8) {
  console.error(`PIN OVERRUN chip0=${over[0]} chip1=${over[1]} -- the idiomatic layer read RANDOM past the ` +
    "captured sequence (code-path divergence or too-short capture)");
  process.exit(1);
}

const distinct = new Set(idio.map((b) => createHash("sha256").update(b).digest("hex"))).size;
if (distinct < MIN_DISTINCT) { console.error(`only ${distinct} distinct idiomatic frames (< ${MIN_DISTINCT}) -- frozen render?`); process.exit(1); }

function nonBlack(g) {
  let c = 0;
  const o = g * FB;
  for (let p = 0; p < SCREEN_W * SCREEN_H; p++) { const j = o + p * 3; if (goldPx[j] || goldPx[j + 1] || goldPx[j + 2]) c++; }
  return c;
}
// Nearest idiomatic frame to golden frame g, searching a window around the linear timeline estimate. `xform`
// (array, byteIndex) -> value lets the null-mutant reuse the rendered frames without a second render.
function nearest(g, xform) {
  const gf = goldPx.subarray(g * FB, (g + 1) * FB);
  const est = Math.round(0.44 * g - 6);
  const lo = g < 80 ? 0 : Math.max(0, est - SEARCH);
  const hi = Math.min(idio.length - 1, g < 80 ? 60 : est + SEARCH);
  let best = FB;
  for (let i = lo; i <= hi; i++) {
    const a = idio[i];
    let d = 0;
    for (let b = 0; b < FB; b++) { if ((xform ? xform(a, b) : a[b]) !== gf[b]) d++; }
    if (d < best) best = d;
  }
  return best;
}

function verdict(xform) {
  let content = 0, exact = 0, within = 0, run = 0, maxRun = 0;
  for (let g = 1; g < nGold; g += GOLD_STRIDE) {
    if (nonBlack(g) < MIN_NONBLACK) continue;
    content++;
    const d = nearest(g, xform);
    if (d === 0) exact++;
    if (d <= BAND) { within++; run = 0; } else { run++; if (run > maxRun) maxRun = run; }
  }
  const pass = content >= MIN_CONTENT &&
    exact / content >= FRAC_EXACT_MIN && within / content >= FRAC_BAND_MIN && maxRun <= MAX_RUN;
  return { content, exact, within, maxRun, pass };
}

const normal = verdict(null);
console.log(`[tempest_pixel] content=${normal.content} byte-exact=${normal.exact} ` +
  `(${(100 * normal.exact / normal.content).toFixed(1)}%) within-1%-band=${normal.within} ` +
  `(${(100 * normal.within / normal.content).toFixed(1)}%) longest-above-band-run=${normal.maxRun}`);

// NULL-MUTANT: swap R and B on every idiomatic pixel (a plausible palette bug); the verdict MUST flip to
// FAIL, or the gate is blind. Reuses the rendered frames (channel b%3: R<->B), so it costs only a diff.
const swapRB = (a, b) => { const ch = b % 3; return ch === 0 ? a[b + 2] : ch === 2 ? a[b - 2] : a[b]; };
const mutant = verdict(swapRB);
console.log(`[tempest_pixel] NULL-MUTANT (R/B swap) byte-exact=${mutant.exact} within-band=${mutant.within} ` +
  `run=${mutant.maxRun} -> ${mutant.pass ? "PASS (BAD)" : "FAIL (good -- gate has teeth)"}`);

if (!normal.pass) { console.error("tempest_pixel: FAIL -- the idiomatic render diverged from the golden past the band"); process.exit(1); }
if (mutant.pass) { console.error("tempest_pixel: FAIL -- the null-mutant still passed; the gate is blind, not trustworthy"); process.exit(1); }
console.log("tempest_pixel: OK");
process.exit(0);
