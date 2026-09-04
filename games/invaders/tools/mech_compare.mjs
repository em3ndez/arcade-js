#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
// mech_compare.mjs — the JS side + comparator for the Space Invaders mechanics_gate poke-vs-MAME suite.
//
// THE MODEL (poke, don't play). A mechanic's scenario is poked IDENTICALLY into MAME (a tape lua captured by
// mame_golden.py) and into the idiomatic JS engine here; the mechanic's effect is then asserted to AGREE with
// MAME — MAME is the ORACLE, no hand-authored expected value, so a faithful-but-wrong port fails too.
//
// WHY THIS DIFFERS FROM frogger/mech_compare.mjs (a full-RAM masked byte-compare). Invaders gameplay carries a
// NON-DETERMINISTIC subsystem — the alien-shot cadence/column (loc_2069..0x2080 + the shots blitted at
// drifting framebuffer positions) accumulates a small per-event timing drift between the two engines (10 bytes
// at f600 growing to 30+ by f750, MEASURED). A frogger-style whole-RAM pin (require maskedDiff==0) is therefore
// infeasible mid-play: the drift is spread through work RAM AND the moving shot sprites in video, which no fixed
// mask can cover. So this comparator PINS the boot/collapse frame offset from the clear masked-diff MINIMUM at a
// pre-poke landmark (invaders' idiomatic boot collapses pure delay, running a stable `offset` frames AHEAD of
// MAME — MEASURED per scenario, the analogue of frogger's fixed delta), then asserts the MECHANIC'S OWN cells
// byte-for-byte against MAME at that offset across a post-poke window. The mechanic's write-set IS grounded
// against the oracle; the orthogonal alien-shot noise is excluded because it is not part of the mechanic.
//
// Reusable; extra_ship_award is its first caller. Prints RESULT lines the suite relays into MECHANIC PASS|FAIL.
// --perturb forces a WRONG JS resolution (skips the trigger poke) to prove the compare can FAIL.

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
    if (next === undefined || next.startsWith("--")) a[name] = true;
    else { a[name] = next; i++; }
  }
  return a;
}
const A = argmap(process.argv);
const req = (k) => { if (A[k] === undefined) { console.error(`RESULT FAIL missing --${k}`); process.exit(1); } return A[k]; };

const GOLDEN = req("golden");
const COIN = Number(A.coin ?? 300), START = Number(A.start ?? 360);
const POKE_F = Number(req("poke-frame"));       // MAME frame at which the scenario is poked
const OFFSET = Number(req("offset"));           // idiomatic ordinal runs OFFSET frames BEHIND the MAME frame
const TALLY_VAL = Number(A["tally-val"] ?? 0x20);
const PIN_LANDMARK = Number(req("pin-landmark")); // pre-poke MAME frame used to confirm the offset alignment
const WIN_LO = Number(req("win-lo")), WIN_HI = Number(req("win-hi")); // post-poke MAME window (inclusive)
const PERTURB = !!A.perturb;

// Cells (fixed player-1 record; the suite pokes the same absolute addresses into MAME).
const FLAG = 0x20e5;   // award-pending flag (activePlayerFlagPtr - 2)
const TALLY = 0x20f9;  // player-1 score tally byte (currentPlayerRecordPtr + 1)
const COUNT = 0x21ff;  // reserve-ship count (readActivePlayerPageTopByte)
// The mechanic's fixed video witness: the lives-digit glyph column at LIVES_DIGIT_SCREEN_ADDR (0x2501), 8 rows
// down (+0x20/row). Repainted by awardExtraShip via drawLivesDigit — a bottom-of-screen region the play-area
// alien shots do not reach, so it is a clean, grounded witness of the redraw (verified agreeing pre-perturb).
const LIVES_CELLS = Array.from({ length: 8 }, (_, r) => 0x2501 + r * 0x20);

// ── golden ───────────────────────────────────────────────────────────────────────────────────────────
const BPF = 0x2000; // invaders state dump = main_ram 0x2000..0x3fff (boards/invaders/memory.js)
const off = (a) => a - 0x2000;
const gbuf = readFileSync(GOLDEN);
const nGolden = Math.floor(gbuf.length / BPF);
const gframe = (i) => gbuf.subarray(i * BPF, (i + 1) * BPF);
const gcell = (i, a) => gframe(i)[off(a)];

// Masked cells for the OFFSET pin only (not the mechanic assertion): the ISR phase flag + vblank frame-delay
// timer + the dead Z80 stack — manifest.convergence.stateExclude, the same mask the state reconverge uses.
const MASK = new Set([off(manifest.convergence.stateExclude.cells[0]), off(manifest.convergence.stateExclude.cells[1])]);
const [sLo, sHi] = manifest.convergence.stateExclude.stack;
for (let a = sLo; a < sHi; a++) MASK.add(off(a));
function maskedDiff(g, j) { let n = 0; for (let o = 0; o < BPF; o++) { if (MASK.has(o)) continue; if (g[o] !== j[o]) n++; } return n; }

// ── run the idiomatic engine with the scenario poked at the JS ordinal that maps to MAME POKE_F ─────────
const A_IN = manifest.inputs.actions;
const ROM = new Uint8Array(readFileSync(new URL("../rom/maincpu.bin", import.meta.url)));
const overrides = await resolveAllIdiomatic();
const mi = new Machine(ROM, { overrides });
const snaps = new Map();
const res = runIdiomaticGame(mi, {
  bootAddr: 0x0000, nmiReturnPC: manifest.convergence.idiomatic.nmiReturnPC, maxFrames: nGolden,
  onFrame: (m, f) => {
    if (f === 0) return;
    const a = {};
    const press = (act) => { a[act.port] = (a[act.port] || 0) | act.bit; };
    if (f >= COIN && f < COIN + 6) press(A_IN.coin);
    if (f >= START && f < START + 6) press(A_IN.start1);
    m.io.inputAssert = a;
    // Poke at the ordinal mapping to MAME POKE_F (MAME = ordinal + OFFSET). --perturb skips the TALLY poke, so
    // the tally never crosses the threshold and the JS award never fires — the compare must then FAIL.
    if (f === POKE_F - OFFSET) {
      m.mem.write8(FLAG, 1);
      if (!PERTURB) m.mem.write8(TALLY, TALLY_VAL);
    }
    snaps.set(f, m.mem.dumpState());
  },
});
if (res.stopError) { console.error(`RESULT FAIL idiomatic run threw: ${res.stopError}`); process.exit(1); }

// ── non-vacuity (positive control): the GOLDEN itself must exhibit the award ─────────────────────────────
// The tally must be seeded at POKE_F and, within a few frames, the reserve count must rise by exactly one and
// the award flag must clear — else we would be comparing two unchanged counts and a "pass" would mean nothing.
const gCountPre = gcell(POKE_F, COUNT), gFlagPre = gcell(POKE_F, FLAG);
const gCountPost = gcell(WIN_HI, COUNT), gFlagPost = gcell(WIN_HI, FLAG);
console.log(`golden(control): count ${gCountPre}->${gCountPost} (want +1), flag ${gFlagPre}->${gFlagPost} (want ->0), tally@${POKE_F}=0x${gcell(POKE_F, TALLY).toString(16)}`);
if (gCountPost !== ((gCountPre + 1) & 0xff) || gFlagPre === 0 || gFlagPost !== 0) {
  console.error("RESULT FAIL golden did not exhibit extra_ship_award (count did not rise by one / flag did not arm+clear) — scenario is vacuous");
  process.exit(1);
}

// ── PIN the frame offset from the CLEAN pre-poke landmark (clear masked-diff minimum) ───────────────────
// The alien-shot drift means the absolute masked diff is never 0, but the true alignment is a distinct
// minimum. Confirm the search minimum lands on the scenario's measured OFFSET and beats its neighbours — a
// minimum on a search edge, or not at OFFSET, means the scenario has drifted and the reconverge cannot be
// trusted. Pins the offset independently of the mechanic under test (pre-poke, before the tally poke).
let bestOff = null, bestD = Infinity, atOffset = null;
const SEARCH_LO = OFFSET - 8, SEARCH_HI = OFFSET + 8;
for (let o = SEARCH_LO; o <= SEARCH_HI; o++) {
  const j = snaps.get(PIN_LANDMARK - o);
  if (!j) continue;
  const d = maskedDiff(gframe(PIN_LANDMARK), j);
  if (o === OFFSET) atOffset = d;
  if (d < bestD) { bestD = d; bestOff = o; }
}
console.log(`pin @ MAME f${PIN_LANDMARK}: min masked-diff offset ${bestOff} (diff ${bestD}); scenario offset ${OFFSET} (diff ${atOffset})`);
if (bestOff === null || atOffset === null) { console.error("RESULT FAIL no JS frame in the pin search window (offset/frames misconfigured)"); process.exit(1); }
if (bestOff !== OFFSET) { console.error(`RESULT FAIL offset pin landed on ${bestOff}, not the scenario offset ${OFFSET} — the scenario has drifted; reconverge cannot be trusted`); process.exit(1); }
if (bestOff <= SEARCH_LO || bestOff >= SEARCH_HI) { console.error(`RESULT FAIL offset pin ${bestOff} hit the search-window edge [${SEARCH_LO},${SEARCH_HI}]`); process.exit(1); }

// ── the mechanic claim: byte-for-byte agreement of the award's cells vs MAME across the post-poke window ──
// Every window frame must be present on both sides (a missing frame is a hard FAIL, never a silent skip).
let fails = [];
let compared = 0;
for (let L = WIN_LO; L <= WIN_HI; L++) {
  if (L < 0 || L >= nGolden) { console.error(`RESULT FAIL window frame f${L} outside golden [0,${nGolden}) — window/golden misconfigured`); process.exit(1); }
  const j = snaps.get(L - OFFSET);
  if (!j) { console.error(`RESULT FAIL window frame f${L} (JS ordinal ${L - OFFSET}) never reached by the JS run`); process.exit(1); }
  compared++;
  if (j[off(COUNT)] !== gcell(L, COUNT)) fails.push(`f${L} count js=${j[off(COUNT)]} mame=${gcell(L, COUNT)}`);
  if (j[off(FLAG)] !== gcell(L, FLAG)) fails.push(`f${L} flag js=${j[off(FLAG)]} mame=${gcell(L, FLAG)}`);
  for (const a of LIVES_CELLS) if (j[off(a)] !== gframe(L)[off(a)]) fails.push(`f${L} lives@0x${a.toString(16)} js=${j[off(a)]} mame=${gframe(L)[off(a)]}`);
}
if (compared !== WIN_HI - WIN_LO + 1) { console.error(`RESULT FAIL window compared ${compared} frames, expected ${WIN_HI - WIN_LO + 1}`); process.exit(1); }
if (fails.length) { console.error(`RESULT FAIL extra_ship_award: JS diverges from MAME on the award cells: ${fails.slice(0, 6).join("; ")}${fails.length > 6 ? ` … (${fails.length} in all)` : ""}`); process.exit(1); }

console.log(`RESULT PASS extra_ship_award: JS==MAME on the award cells (reserve count +1 -> ${gCountPost}, award flag -> 0, lives-digit column repainted) across all ${compared} frames f${WIN_LO}..${WIN_HI} at pinned offset ${OFFSET}`);
process.exit(0);
