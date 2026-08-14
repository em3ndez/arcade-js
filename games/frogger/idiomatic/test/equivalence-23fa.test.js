// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_23fa — memory-equivalent to the frozen oracle at ROM 0x23FA.
 * GATE: crafted-entry. Plain attract never dispatches this lane-marker setup (measured: 0 dispatches
 * over ENTRY_FRAMES). A corpus of REAL attract machine states is captured at the column-copy
 * primitive (0x0028, which fires constantly); on each, the scroll-source cell, the count cell and the
 * two flag banks are poked to drive every path — mirror-only (lane out of range), each lane 1..5
 * stamping through the primary bank (count 1) and the alternate bank (count != 1), and the
 * object-present skip — identically on both sides. The lane home block and the mirror cell are
 * pre-painted with a sentinel so every write is observable. The routine reads no live register and
 * its live-out is memory-only, so registers/SP are not compared. Teeth: four broken twins.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { loc_23fa } from "../loc_23fa.js";
import { loc_23fa as oracle } from "../../translated/loc_23fa.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const STATE_SOURCE = 0x0028;
const CAP = 60;
const STRIDE = 90;

const SCROLL_SOURCE = 0x8123;
const MIRROR = 0x8121;
const COUNT_CELL = 0x83fd;
const TILES = [44, 45, 46, 47];

const LANE_HOME = [0xab64, 0xaaa4, 0xa9e4, 0xa924, 0xa864];
const FLAGS_PRIMARY = [0x825e, 0x825f, 0x8260, 0x8261, 0x8262];
const FLAGS_ALT = [0x8263, 0x8264, 0x8265, 0x8266, 0x8267];
const SENTINEL = 0xee;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

let states = null;
function corpus() {
  if (states) return states;
  const out = [];
  let seen = 0;
  const real = TRANSLATED.get(STATE_SOURCE);
  const m = makeMachine(new Map([[STATE_SOURCE, (mm) => {
    if (seen++ % STRIDE === 0 && out.length < CAP) out.push(mm.clone());
    return real(mm);
  }]]));
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the capture run stopped early: ${m.stoppedBy}`);
  states = out;
  return states;
}

// Every scenario: lane index, the count that picks the bank, and each flag bank's value.
function scenarios() {
  const out = [];
  for (let lane = 1; lane <= 5; lane++) {
    out.push({ lane, count: 1, primary: 0, alt: 9 }); // primary bank -> stamp
    out.push({ lane, count: 2, primary: 9, alt: 0 }); // alternate bank -> stamp
    out.push({ lane, count: 1, primary: 7, alt: 0 }); // primary bank, object present -> skip
    out.push({ lane, count: 2, primary: 0, alt: 7 }); // alternate bank, object present -> skip
  }
  out.push({ lane: 0, count: 1, primary: 0, alt: 0 }); // below range -> mirror only
  out.push({ lane: 6, count: 1, primary: 0, alt: 0 }); // above range -> mirror only
  return out;
}

// A real attract state with the routine's inputs poked and its write-set pre-painted so a
// missed/extra/wrong write shows as a difference.
function crafted(state, s) {
  const e = state.clone();
  const { mem8 } = e;
  mem8[COUNT_CELL] = s.count;
  mem8[SCROLL_SOURCE] = s.lane;
  mem8[MIRROR] = SENTINEL;
  const i = s.lane - 1;
  if (i >= 0 && i < 5) {
    mem8[FLAGS_PRIMARY[i]] = s.primary;
    mem8[FLAGS_ALT[i]] = s.alt;
    for (let a = (LANE_HOME[i] - 2) & 0xffff, end = (LANE_HOME[i] + 36) & 0xffff; a !== end; a = (a + 1) & 0xffff) mem8[a] = SENTINEL;
  }
  return e;
}

// null == RAM-equivalent, both sides run from the same crafted state. Memory-only live-out.
function ramDiff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

// broken twins, each leaving wrong RAM the diff must catch.
function brokenNoOp() {}
function stampAt(mem8, i, tiles) {
  let p = LANE_HOME[i];
  mem8[p] = tiles[0];
  mem8[(p + 1) & 0xffff] = tiles[1];
  p = (p + 32) & 0xffff;
  mem8[p] = tiles[2];
  mem8[(p + 1) & 0xffff] = tiles[3];
}
function brokenWrongTile(m) { // right structure, wrong top-left tile
  const { mem8 } = m;
  const lane = mem8[SCROLL_SOURCE]; mem8[MIRROR] = lane;
  if (lane < 1 || lane > 5) return; const i = lane - 1;
  const flag = mem8[COUNT_CELL] === 1 ? FLAGS_PRIMARY[i] : FLAGS_ALT[i];
  if (mem8[flag] !== 0) return;
  stampAt(mem8, i, [TILES[0] + 1, TILES[1], TILES[2], TILES[3]]);
}
function brokenIgnoreFlag(m) { // wrong arm: stamps even when the object is present
  const { mem8 } = m;
  const lane = mem8[SCROLL_SOURCE]; mem8[MIRROR] = lane;
  if (lane < 1 || lane > 5) return; const i = lane - 1;
  stampAt(mem8, i, TILES);
}
function brokenWrongBank(m) { // wrong arm: always reads the primary bank
  const { mem8 } = m;
  const lane = mem8[SCROLL_SOURCE]; mem8[MIRROR] = lane;
  if (lane < 1 || lane > 5) return; const i = lane - 1;
  if (mem8[FLAGS_PRIMARY[i]] !== 0) return;
  stampAt(mem8, i, TILES);
}

test("CRAFTED: over real attract states x every path, oracle == rewrite", { skip }, () => {
  const c = corpus();
  const scen = scenarios();
  assert.ok(c.length > 0, "vacuous: no attract states were captured");
  for (const st of c) for (const s of scen) assert.equal(ramDiff(loc_23fa, crafted(st, s)), null, `diverged: lane=${s.lane} count=${s.count}`);
  // non-vacuous: the no-op twin diverges on a stamp path, proving the oracle actually writes.
  assert.ok(ramDiff(brokenNoOp, crafted(c[0], { lane: 1, count: 1, primary: 0, alt: 9 })), "vacuous: oracle wrote nothing");
  console.log(`  CRAFTED: ${c.length} states x ${scen.length} paths, oracle == rewrite`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const c = corpus();
  const stampState = crafted(c[0], { lane: 2, count: 1, primary: 0, alt: 9 });
  const skipState = crafted(c[0], { lane: 2, count: 1, primary: 7, alt: 0 });
  const altStampState = crafted(c[0], { lane: 3, count: 2, primary: 9, alt: 0 });
  assert.ok(ramDiff(brokenNoOp, stampState), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongTile, stampState), "the wrong-tile twin escaped");
  assert.ok(ramDiff(brokenIgnoreFlag, skipState), "the ignore-flag arm twin escaped");
  assert.ok(ramDiff(brokenWrongBank, altStampState), "the wrong-bank arm twin escaped");
  console.log("  TEETH: no-op, wrong-tile, ignore-flag, wrong-bank all caught");
});
