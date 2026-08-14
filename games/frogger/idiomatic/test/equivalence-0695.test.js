// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0695 — memory-equivalent to the frozen oracle at ROM 0x0695.
 * GATE: crafted-entry. This 2-by-2 marker stamp runs in home-marker setup, which plain attract never
 * reaches (measured: 0 dispatches in 6000 attract frames). A corpus of REAL attract machine states is
 * captured (snapshotted at the column-copy primitive, which fires constantly); on each, the base is
 * poked to each of the five real slot bases the caller uses, identically on both sides, and the oracle
 * and rewrite are run and their RAM compared. The base is the only live-in and the live-out is
 * memory-only, so registers and SP are not compared. Teeth: three broken twins the RAM diff catches.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { loc_0695 } from "../loc_0695.js";
import { loc_0695 as oracle } from "../../translated/loc_0695.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const STATE_SOURCE = 0x0028;
const CAP = 120;
const STRIDE = 90;
const BASES = [0xab64, 0xaaa4, 0xa9e4, 0xa924, 0xa864]; // the five real slot bases from the caller
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

// Real attract VRAM at these slots already holds the fill tile, so a fresh fill would be invisible.
// The surgical nudge: paint the target block (and margins) with a sentinel on BOTH sides first, so
// every cell the routine writes is observable and a missed/extra/wrong write shows as a difference.
const SENTINEL = 0xee;
function paint(m, base) {
  const { mem8 } = m;
  for (let a = (base - 2) & 0xffff, end = (base + 36) & 0xffff; a !== end; a = (a + 1) & 0xffff) mem8[a] = SENTINEL;
}

// null == RAM-equivalent, running both sides from the same painted base. Memory-only live-out.
function ramDiff(cand, machine, base) {
  const a = machine.clone(); paint(a, base); a.regs.hl = base; oracle(a);
  const b = machine.clone(); paint(b, base); b.regs.hl = base; cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

function brokenNoOp() {}
function brokenWrongTile(m, base = m.regs.hl) {
  const { mem8 } = m;
  mem8[base] = 17; mem8[(base + 1) & 0xffff] = 17; mem8[(base + 32) & 0xffff] = 17; mem8[(base + 33) & 0xffff] = 17;
}
function brokenMissBottom(m, base = m.regs.hl) { // stamps only the top row
  const { mem8 } = m;
  mem8[base] = 16; mem8[(base + 1) & 0xffff] = 16;
}

test("CRAFTED: over real attract states x real bases, oracle == rewrite", { skip }, () => {
  const c = corpus();
  assert.ok(c.length > 0, "vacuous: no attract states were captured");
  for (const s of c) for (const base of BASES) assert.equal(ramDiff(loc_0695, s, base), null, `diverged at base 0x${base.toString(16)}`);
  console.log(`  CRAFTED: ${c.length} states x ${BASES.length} bases, oracle == rewrite`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const c = corpus();
  const base = BASES[0];
  for (const [name, twin] of [["no-op", brokenNoOp], ["wrong-tile", brokenWrongTile], ["miss-bottom", brokenMissBottom]]) {
    assert.ok(c.some((s) => ramDiff(twin, s, base) !== null), `the ${name} twin escaped on every state`);
  }
  console.log("  TEETH: no-op, wrong-tile, miss-bottom all caught");
});
