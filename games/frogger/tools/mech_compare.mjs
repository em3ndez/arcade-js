#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
// mech_compare.mjs — the JS side + state comparator for the Frogger mechanics_gate poke-vs-MAME suite.
//
// THE MODEL (poke, don't play). A mechanic's scenario is poked IDENTICALLY into MAME (a tape lua captured by
// mame_golden.py) and into the idiomatic JS engine here; a few frames are driven and the two RAMs asserted
// to AGREE — MAME is the oracle, no hand-authored expected value. The idiomatic boot reaches the main loop in
// fewer vblank yields than MAME's cycle-driven boot, so the JS run is a CONSTANT `--delta` ordinals AHEAD (a
// phase offset, measured at 51; test/vs-oracle-gameplay.test.js). A timing-sensitive poke is applied `delta`
// ordinals EARLIER in JS, and the compare is at the reconverge offset (min masked diff), masking only the
// dead Z80 stack [0x87e0,0x8800) and the attract clock (0x83bd/0x83be) — as the vs-oracle test.
// Reusable; timer_expiry is its first caller. Prints RESULT lines the suite relays into MECHANIC PASS|FAIL.
// Args are parsed below; --perturb-timer forces a wrong JS tick to prove the compare can FAIL.

import { readFileSync } from "node:fs";
import { Machine, resolveAllIdiomatic } from "../machine.js";
import { runIdiomaticGame } from "../../../core/frame-stepped.js";
import manifest from "../manifest.js";

// ── args ─────────────────────────────────────────────────────────────────────────────────────────────
function argmap(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith("--")) continue;
    const name = k.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) { a[name] = true; }
    else { a[name] = next; i++; }
  }
  return a;
}
const A = argmap(process.argv);
const req = (k) => { if (A[k] === undefined) { console.error(`RESULT FAIL missing --${k}`); process.exit(1); } return A[k]; };

const GOLDEN = req("golden");
const DELTA = Number(A.delta ?? 51);
const COIN = Number(A.coin ?? 150), START = Number(A.start ?? 210);
const GATE_HOLD_FROM = Number(req("gate-hold-from"));
const [POKE_F_S, POKE_V_S] = String(req("timer-poke")).split("=");
const POKE_F = Number(POKE_F_S), POKE_V = Number(POKE_V_S);
const FRAMES = Number(A.frames ?? 380);
const PRE_LANDMARK = Number(req("pre-landmark"));
const DRAIN_LANDMARK = Number(req("drain-landmark"));
const WINDOW = Number(A.window ?? 14);
const [SEARCH_LO, SEARCH_HI] = String(A.search ?? "30,72").split(",").map(Number);
const PERTURB = !!A["perturb-timer"];

// ── state layout (work | video | obj, concatenated — boards/frogger/memory.js dumpState) ──────────────
const BPF = 3328, WORK = 0x800, VID = 0x400;
const WORK_BASE = 0x8000, VIDEO_BASE = 0xa800, OBJ_BASE = 0xb000;
const addrToOff = (a) =>
  a >= WORK_BASE && a < WORK_BASE + WORK ? a - WORK_BASE
  : a >= VIDEO_BASE && a < VIDEO_BASE + VID ? WORK + (a - VIDEO_BASE)
  : WORK + VID + (a - OBJ_BASE);
const offToAddr = (o) =>
  o < WORK ? WORK_BASE + o : o < WORK + VID ? VIDEO_BASE + (o - WORK) : OBJ_BASE + (o - WORK - VID);

// Masked cells: the dead Z80 stack scratch below SP, and the free-running attract-cell frame clock.
const MASK = new Set();
for (let a = 0x87e0; a < 0x8800; a++) MASK.add(addrToOff(a)); // manifest.convergence.stateExclude.stack
MASK.add(addrToOff(0x83bd)); // ATTRACT_FRAME_TIMER
MASK.add(addrToOff(0x83be)); // ATTRACT_FRAME_INDEX

const TIME_OFF = addrToOff(0x83e5), CF_OFF = addrToOff(0x83cf);

const gbuf = readFileSync(GOLDEN);
const nGolden = Math.floor(gbuf.length / BPF);
const gframe = (i) => gbuf.subarray(i * BPF, (i + 1) * BPF);

const U = (p) => new Uint8Array(readFileSync(new URL(p, import.meta.url)));
const ROM = U("../rom/maincpu.bin"), GFX = U("../rom/gfx.bin"), PR = U("../rom/proms.bin");

const mi = await Machine.create(ROM, { gfx: GFX, proms: PR, overrides: await resolveAllIdiomatic() });
mi.inputTape = [
  { frame: COIN, port: 0xe000, bits: 0x80, dur: 8 },
  { frame: START, port: 0xe002, bits: 0x80, dur: 8 },
];
mi.pokes = [
  { addr: 0x83ea, val: 0, frame: GATE_HOLD_FROM - DELTA, dur: null },   // hold board-layout gate open
  { addr: 0x83e5, val: POKE_V, frame: POKE_F - DELTA, dur: 1 },         // seed the timer once
];

// FAIL-PROOF: optionally corrupt the JS timer tick by continuously forcing 0x83e5 to a wrong value, so the
// JS drain trajectory diverges from MAME. Proves the compare has teeth (a wrong JS => MECHANIC ... FAIL).
if (PERTURB) mi.pokes.push({ addr: 0x83e5, val: (POKE_V + 3) & 0xff, frame: POKE_F - DELTA, dur: null });

const snaps = new Map();
const res = runIdiomaticGame(mi, {
  nmiReturnPC: manifest.convergence.idiomatic.nmiReturnPC,
  maxFrames: FRAMES,
  onFrame: (m, f) => { m.applyInputs(f); m.applyPokes(f); snaps.set(f, m.mem.dumpState()); },
});
if (res.stopError) { console.error(`RESULT FAIL idiomatic run threw: ${res.stopError}`); process.exit(1); }

function maskedDiff(g, j) { let n = 0; for (let o = 0; o < BPF; o++) { if (MASK.has(o)) continue; if (g[o] !== j[o]) n++; } return n; }
function firstDiffAddr(g, j) { for (let o = 0; o < BPF; o++) { if (MASK.has(o)) continue; if (g[o] !== j[o]) return offToAddr(o); } return null; }
function bestOffset(L) {
  let best = null;
  for (let off = SEARCH_LO; off <= SEARCH_HI; off++) {
    const j = snaps.get(L - off); if (!j) continue;
    const d = maskedDiff(gframe(L), j);
    if (best === null || d < best.d) best = { off, d };
  }
  return best;
}

// ── non-vacuity (positive control): the GOLDEN itself must exhibit the mechanic ─────────────────────────
// The timer must be seeded to POKE_V at POKE_F and drain to 0 with the expiry flag (0x83cf) rising — else we
// would be comparing two frozen timers and a "pass" would mean nothing.
const gSeed = gframe(POKE_F)[TIME_OFF];
const gZeroF = POKE_F + POKE_V;                       // frame the poked countdown hits 0
const gZero = gZeroF < nGolden ? gframe(gZeroF)[TIME_OFF] : -1;
const gExpiry = gZeroF < nGolden ? gframe(gZeroF)[CF_OFF] : -1;
console.log(`golden(control): time@${POKE_F}=${gSeed} (want ${POKE_V}); time@${gZeroF}=${gZero} (want 0); cf@${gZeroF}=${gExpiry} (want 1)`);
if (gSeed !== POKE_V || gZero !== 0 || gExpiry !== 1) {
  console.error(`RESULT FAIL golden did not exhibit timer_expiry (seed/drain/flag control failed) — scenario is vacuous`);
  process.exit(1);
}

// ── PIN the reconverge offset from the CLEAN pre-poke frozen region ─────────────────────────────────────
// The pre-poke landmark sits BEFORE the gate-hold/timer poke, in the settled frozen in-play state both
// engines reach identically. Measuring the offset there pins it independently of the mechanic under test, so
// a wrong timer tick can only ever make the DRAIN window (asserted at this fixed offset) diverge — it cannot
// hide by shifting the measured offset. A minimum on a search-window edge means the true offset is outside.
const pre = bestOffset(PRE_LANDMARK);
console.log(`pre-poke landmark f${PRE_LANDMARK}: best offset ${pre?.off}  maskedDiff ${pre?.d}`);
if (!pre) { console.error("RESULT FAIL no JS frame in the search window (delta/frames misconfigured)"); process.exit(1); }
if (pre.off <= SEARCH_LO || pre.off >= SEARCH_HI) {
  console.error(`RESULT FAIL pre-poke reconverge offset ${pre.off} hit the search-window edge [${SEARCH_LO},${SEARCH_HI}]`);
  process.exit(1);
}
if (pre.d !== 0) {
  const a = firstDiffAddr(gframe(PRE_LANDMARK), snaps.get(PRE_LANDMARK - pre.off));
  console.error(`RESULT FAIL pre-poke frozen state does not agree with MAME (${pre.d} byte(s) at offset ` +
    `${pre.off}; first diff 0x${(a ?? 0).toString(16)}) — cannot trust the reconverge`);
  process.exit(1);
}
const OFF = pre.off; // the pinned reconverge offset used for the whole drain window

// Diagnostic-only: the drain landmark's own best offset should agree with the pinned one.
const drain = bestOffset(DRAIN_LANDMARK);
console.log(`drain    landmark f${DRAIN_LANDMARK}: best offset ${drain?.off}  maskedDiff ${drain?.d}  (pinned offset ${OFF})`);

// ── the equivalence claim: byte-for-byte agreement across the WHOLE drain window at the PINNED offset ───
// Positive control: every intended window frame must be present on BOTH sides. A silent skip past a missing
// frame would let a too-short JS run (or a golden that stops early) report byte-for-byte agreement over a
// window where nothing was compared — the exact "green while verifying nothing" this gate exists to stop.
// So a missing frame is a hard FAIL, and the compared count must equal the full inclusive window.
let worst = { d: 0, L: DRAIN_LANDMARK, addr: null };
let compared = 0;
for (let L = DRAIN_LANDMARK - WINDOW; L <= DRAIN_LANDMARK; L++) {
  if (L < 0 || L >= nGolden) {
    console.error(`RESULT FAIL drain window frame f${L} is outside the golden capture [0,${nGolden}) — ` +
      `window/drain-landmark misconfigured or the golden is too short to cover the drain`);
    process.exit(1);
  }
  const j = snaps.get(L - OFF);
  if (!j) {
    console.error(`RESULT FAIL drain window frame f${L} (JS ordinal ${L - OFF}) was never reached by the JS ` +
      `run — --frames ${FRAMES} is too short to cover the drain window at reconverge offset ${OFF}`);
    process.exit(1);
  }
  compared++;
  const d = maskedDiff(gframe(L), j);
  if (d > worst.d) worst = { d, L, addr: firstDiffAddr(gframe(L), j) };
}
if (compared !== WINDOW + 1) {
  console.error(`RESULT FAIL drain window compared ${compared} frame(s), expected ${WINDOW + 1} — the ` +
    `equivalence claim would cover fewer frames than it asserts`);
  process.exit(1);
}
if (worst.d !== 0) {
  const g = gframe(worst.L), j = snaps.get(worst.L - OFF);
  const off = addrToOff(worst.addr ?? 0x8000);
  console.error(`RESULT FAIL JS diverges from MAME during timer drain: ${worst.d} unmasked byte(s) differ ` +
    `at MAME f${worst.L} (pinned offset ${OFF}); first diverging address 0x${(worst.addr ?? 0).toString(16)} ` +
    `golden=0x${g[off].toString(16)} js=0x${j[off].toString(16)}`);
  process.exit(1);
}
const bestOff = OFF;

console.log(`RESULT PASS timer_expiry: JS==MAME byte-for-byte across all ${compared} frames of ` +
  `f${DRAIN_LANDMARK - WINDOW}..${DRAIN_LANDMARK} at reconverge offset ${bestOff} ` +
  `(timer drained ${POKE_V}->0, expiry flag 0x83cf raised; both engines agree)`);
process.exit(0);
