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
// KEEP EACH COMPARE WINDOW PRE-COLLAPSE. A death / alien-explosion enters a despawn/animation busy-wait that the
// idiomatic engine COLLAPSES (jumping the frame offset), so a byte-compare cannot span it (runbook). Every
// mechanic below asserts its cells in the window AFTER the poke but BEFORE that collapse — the mechanic's own
// write-set has already settled there.
//
// GENERIC over mechanics via the MECHANICS registry (one entry per declared id, kept in lockstep with the MAME
// tape lua + the tools/mechanics_suite.py scenario dict). Each entry supplies: poke() (the JS-side trigger,
// identical to the tape; --perturb drops the trigger to prove teeth), control() (the golden-exhibits-the-mechanic
// positive control), cells (the write-set asserted JS==MAME across the window), and pass() (the success line).
// Prints RESULT lines the suite relays into MECHANIC PASS|FAIL.

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
const MECH_ID = req("mechanic");
const COIN = Number(A.coin ?? 300), START = Number(A.start ?? 360);
const POKE_F = Number(req("poke-frame"));       // MAME frame at which the scenario is poked
const OFFSET = Number(req("offset"));           // idiomatic ordinal runs OFFSET frames BEHIND the MAME frame
const TALLY_VAL = Number(A["tally-val"] ?? 0x20);
const PIN_LANDMARK = Number(req("pin-landmark")); // pre-poke MAME frame used to confirm the offset alignment
const WIN_LO = Number(req("win-lo")), WIN_HI = Number(req("win-hi")); // post-poke MAME window (inclusive)
const PERTURB = !!A.perturb;

// ── golden ───────────────────────────────────────────────────────────────────────────────────────────
const BPF = 0x2000; // invaders state dump = main_ram 0x2000..0x3fff (boards/invaders/memory.js)
const off = (a) => a - 0x2000;
const gbuf = readFileSync(GOLDEN);
const nGolden = Math.floor(gbuf.length / BPF);
const gframe = (i) => gbuf.subarray(i * BPF, (i + 1) * BPF);
const gcell = (i, a) => gframe(i)[off(a)];
const gword = (i, a) => gcell(i, a) | (gcell(i, a + 1) << 8);

// ── the mechanic registry (lockstep with tapes/<id>.lua + tools/mechanics_suite.py) ─────────────────────
// Fixed player-1 record; the tapes poke the same absolute addresses into MAME.
const AWARD = { FLAG: 0x20e5, TALLY: 0x20f9, COUNT: 0x21ff };
// The award's fixed video witness: the lives-digit glyph column at LIVES_DIGIT_SCREEN_ADDR (0x2501), 8 rows
// down (+0x20/row). Repainted by awardExtraShip via drawLivesDigit — a bottom-of-screen region the play-area
// alien shots do not reach, so it is a clean, grounded witness of the redraw (verified agreeing pre-perturb).
const LIVES_CELLS = Array.from({ length: 8 }, (_, r) => 0x2501 + r * 0x20);

const MECHANICS = {
  // awardExtraShip (0x0935): at the poke frame arm the award-pending flag (0x20e5) and seat the score tally
  // (0x20f9) above the port-2 bonus threshold; awardExtraShip grants exactly once — reserve count (0x21ff) +1,
  // flag cleared, the lives-digit column repainted. --perturb drops the tally seat so the award never fires.
  extra_ship_award: {
    poke(m, { perturb }) {
      m.mem.write8(AWARD.FLAG, 1);
      if (!perturb) m.mem.write8(AWARD.TALLY, TALLY_VAL);
    },
    control() {
      const countPre = gcell(POKE_F, AWARD.COUNT), flagPre = gcell(POKE_F, AWARD.FLAG);
      const countPost = gcell(WIN_HI, AWARD.COUNT), flagPost = gcell(WIN_HI, AWARD.FLAG);
      const ok = countPost === ((countPre + 1) & 0xff) && flagPre !== 0 && flagPost === 0;
      return {
        ok,
        log: `golden(control): count ${countPre}->${countPost} (want +1), flag ${flagPre}->${flagPost} (want ->0), tally@${POKE_F}=0x${gcell(POKE_F, AWARD.TALLY).toString(16)}`,
        fail: "golden did not exhibit extra_ship_award (count did not rise by one / flag did not arm+clear)",
      };
    },
    cells: [AWARD.COUNT, AWARD.FLAG, ...LIVES_CELLS],
    pass: () => `reserve count +1 -> ${gcell(WIN_HI, AWARD.COUNT)}, award flag -> 0, lives-digit column repainted`,
  },

  // resolvePlayerShotHit (0x14d8): seat a live player shot one step below a bottom-row alien; the ROM's shot
  // stepper drives it up, drawSpriteWithCollision latches the hit, and the resolver kills the alien next frame
  // — grid cell 0x2100 live->0, PLAYER_SHOT_STATUS 2->5, ALIEN_COUNT -1, kill score added (0x20f8/0x20f9).
  // --perturb drops the whole shot seat, so the JS side never kills (MAME still does) — the compare must FAIL.
  player_shot_hits_alien: {
    CELL: 0x2100, STATUS: 0x2025, COUNT: 0x2082, SCORE: 0x20f8,
    SHOT: { 0x2025: 0x02, 0x2026: 0x10, 0x2027: 0x90, 0x2028: 0x1c, 0x2029: 0x74, 0x202a: 0x44, 0x202b: 0x01, 0x202c: 0x04, 0x202d: 0x01 },
    poke(m, { perturb }) {
      if (perturb) return; // no shot -> no kill on the JS side, while the MAME tape kills -> compare FAILS
      for (const [addr, val] of Object.entries(this.SHOT)) m.mem.write8(Number(addr), val);
    },
    control() {
      const cellPre = gcell(POKE_F, this.CELL), cellPost = gcell(WIN_HI, this.CELL);
      const statusPost = gcell(WIN_HI, this.STATUS);
      const countPre = gcell(POKE_F, this.COUNT), countPost = gcell(WIN_HI, this.COUNT);
      const scorePre = gword(POKE_F, this.SCORE), scorePost = gword(WIN_HI, this.SCORE);
      const ok = cellPre !== 0 && cellPost === 0 && statusPost === 0x05 &&
        countPost === ((countPre - 1) & 0xff) && scorePost !== scorePre;
      return {
        ok,
        log: `golden(control): cell 0x${this.CELL.toString(16)} ${cellPre}->${cellPost} (want live->0), status@${WIN_HI}=${statusPost} (want 5), ALIEN_COUNT ${countPre}->${countPost} (want -1), score 0x${scorePre.toString(16)}->0x${scorePost.toString(16)} (want changed)`,
        fail: "golden did not exhibit player_shot_hits_alien (cell not cleared / status not 5 / ALIEN_COUNT not -1 / score unchanged)",
      };
    },
    get cells() { return [this.CELL, this.STATUS, this.COUNT, this.SCORE, this.SCORE + 1]; },
    pass() { return `alien cell 0x${this.CELL.toString(16)} killed (live->0), PLAYER_SHOT_STATUS -> 5, ALIEN_COUNT -> ${gcell(WIN_HI, this.COUNT)}, kill score added`; },
  },

  // playerShipHandler (0x028e): seat the record-0 death drain (the ship-hit state) with two reserves; the ROM
  // consumes the life on its own — reserve count (0x21ff) 2->1, the round continues (GAME_ACTIVE / GAME_IN_PROGRESS
  // stay set — a respawn). --perturb drops the death-drain seat (reserves still seated), so the JS ship never
  // dies (reserve stays 2) while the MAME tape drops it to 1 — the compare must FAIL.
  player_death: {
    RESV: 0x21ff, GAME_ACTIVE: 0x20e9, GAME_IN_PROGRESS: 0x20ef, RESERVES: 0x02,
    DRAIN: { 0x2010: 0x00, 0x2011: 0x00, 0x2012: 0x00, 0x2013: 0x8e, 0x2014: 0x02, 0x2015: 0x00, 0x2016: 0x01, 0x2017: 0x01, 0x206d: 0x00 },
    poke(m, { perturb }) {
      m.mem.write8(this.RESV, this.RESERVES); // seat reserves (setup, always) so the drop is non-vacuous
      if (perturb) return; // no death-drain seat -> the JS ship never dies, while the MAME tape drops a life -> FAILS
      for (const [addr, val] of Object.entries(this.DRAIN)) m.mem.write8(Number(addr), val);
    },
    control() {
      const resvPre = gcell(POKE_F, this.RESV), resvPost = gcell(WIN_HI, this.RESV);
      const gaPost = gcell(WIN_HI, this.GAME_ACTIVE), gipPost = gcell(WIN_HI, this.GAME_IN_PROGRESS);
      const ok = resvPre === this.RESERVES && resvPost === ((this.RESERVES - 1) & 0xff) && gaPost === 1 && gipPost !== 0;
      return {
        ok,
        log: `golden(control): reserve ${resvPre}->${resvPost} (want ${this.RESERVES}->${this.RESERVES - 1}), GAME_ACTIVE@${WIN_HI}=${gaPost} (want 1), GAME_IN_PROGRESS@${WIN_HI}=${gipPost} (want !=0)`,
        fail: `golden did not exhibit player_death (reserve did not drop ${this.RESERVES}->${this.RESERVES - 1}, or the round did not continue)`,
      };
    },
    get cells() { return [this.RESV, this.GAME_ACTIVE, this.GAME_IN_PROGRESS]; },
    pass() { return `reserve count ${this.RESERVES} -> ${gcell(WIN_HI, this.RESV)} (a life lost), the round continued (GAME_ACTIVE stays 1 — a respawn)`; },
  },
};

const MECH = MECHANICS[MECH_ID];
if (!MECH) { console.error(`RESULT FAIL unknown --mechanic ${MECH_ID} (registry has: ${Object.keys(MECHANICS).join(", ")})`); process.exit(1); }

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
    // Poke at the ordinal mapping to MAME POKE_F (MAME = ordinal + OFFSET). --perturb drops the mechanic's
    // trigger so the JS effect never fires and the compare must FAIL.
    if (f === POKE_F - OFFSET) MECH.poke(m, { perturb: PERTURB });
    snaps.set(f, m.mem.dumpState());
  },
});
if (res.stopError) { console.error(`RESULT FAIL idiomatic run threw: ${res.stopError}`); process.exit(1); }

// ── non-vacuity (positive control): the GOLDEN itself must exhibit the mechanic ──────────────────────────
// Without this the compare could be two unchanged states and a "pass" would mean nothing.
const ctl = MECH.control();
console.log(ctl.log);
if (!ctl.ok) { console.error(`RESULT FAIL ${ctl.fail} — scenario is vacuous`); process.exit(1); }

// ── PIN the frame offset from the CLEAN pre-poke landmark (clear masked-diff minimum) ───────────────────
// The alien-shot drift means the absolute masked diff is never 0, but the true alignment is a distinct
// minimum. Confirm the search minimum lands on the scenario's measured OFFSET and beats its neighbours — a
// minimum on a search edge, or not at OFFSET, means the scenario has drifted and the reconverge cannot be
// trusted. Pins the offset independently of the mechanic under test (pre-poke, before the trigger poke).
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

// ── the mechanic claim: byte-for-byte agreement of the mechanic's cells vs MAME across the post-poke window ──
// Every window frame must be present on both sides (a missing frame is a hard FAIL, never a silent skip).
const cells = MECH.cells;
let fails = [];
let compared = 0;
for (let L = WIN_LO; L <= WIN_HI; L++) {
  if (L < 0 || L >= nGolden) { console.error(`RESULT FAIL window frame f${L} outside golden [0,${nGolden}) — window/golden misconfigured`); process.exit(1); }
  const j = snaps.get(L - OFFSET);
  if (!j) { console.error(`RESULT FAIL window frame f${L} (JS ordinal ${L - OFFSET}) never reached by the JS run`); process.exit(1); }
  compared++;
  for (const a of cells) if (j[off(a)] !== gcell(L, a)) fails.push(`f${L} cell 0x${a.toString(16)} js=${j[off(a)]} mame=${gcell(L, a)}`);
}
if (compared !== WIN_HI - WIN_LO + 1) { console.error(`RESULT FAIL window compared ${compared} frames, expected ${WIN_HI - WIN_LO + 1}`); process.exit(1); }
if (fails.length) { console.error(`RESULT FAIL ${MECH_ID}: JS diverges from MAME on the mechanic cells: ${fails.slice(0, 6).join("; ")}${fails.length > 6 ? ` … (${fails.length} in all)` : ""}`); process.exit(1); }

console.log(`RESULT PASS ${MECH_ID}: JS==MAME on the mechanic cells (${MECH.pass()}) across all ${compared} frames f${WIN_LO}..${WIN_HI} at pinned offset ${OFFSET}`);
process.exit(0);
