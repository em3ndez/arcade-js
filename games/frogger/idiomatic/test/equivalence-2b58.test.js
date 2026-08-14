// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2b58 — memory-equivalent to the frozen oracle at ROM 0x2B58.
 * GATE: crafted-entry. Attract NEVER dispatches this IX sprite-object hit-test arm (probe: 0 over 5000
 * frames; it runs only in the in-play cluster 0x2970 -> 0x29b9), so a post-boot attract clone gets IX/IY
 * at a descriptor pair (0x8440 / 0x8048) and cells poked for every branch: inactive, wrong-row, a hit
 * for each direction bit (the +16 bias path), the borrow (below) miss, the too-far miss, and both window
 * boundaries. Live-in IX/IY (preserved) + RAM; LIVE-OUT memory-only (raises 0x8004 and 0x842c).
 * NOTE: links once names.js exports loc_8004 (the hit flag), added in the naming pass.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_2b58 } from "../loc_2b58.js";
import { loc_2b58 as oracle } from "../../translated/loc_2b58.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const IX = 0x8440;
const IY = 0x8048;
const FROG_ROW = 0x8047;
const FROG_POS = 0x8044;
const HIT_FLAG = 0x8004;
const GATE = 0x842c;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

let seed = null;
function seedMachine() {
  if (seed) return seed;
  const m = makeMachine();
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the seed run stopped early: ${m.stoppedBy}`);
  seed = m.clone();
  return seed;
}

function entry(pokes) {
  const e = seedMachine().clone();
  e.regs.ix = IX;
  e.regs.iy = IY;
  for (const [a, v] of Object.entries(pokes)) e.mem.write8(Number(a), v);
  return e;
}
const o = (n) => IX + n;
const s = (n) => IY + n;

function ramDiff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

// A hit on the direction-set (bias) path, sentinelled so a missed flag write diverges.
const HIT_DIR1 = { [o(6)]: 1, [o(4)]: 0x10, [FROG_ROW]: 0x12, [o(5)]: 0x80, [s(0)]: 0x40, [FROG_POS]: 0x48, [HIT_FLAG]: 0xaa, [GATE]: 0xaa };

// broken twins.
function brokenNoOp() {}
function brokenSkipGate(m) { m.mem.write8(HIT_FLAG, 1); } // raises the hit flag but not the gate
function brokenNoBias(m) { // ignores the +16 direction bias -> misjudges the dir-set overlap
  const ix = m.regs.ix, iy = m.regs.iy;
  if (m.mem.read8(ix + 6) === 0) return;
  if (((m.mem.read8(ix + 4) + 2) & 0xff) !== m.mem.read8(FROG_ROW)) return;
  const pos = m.mem.read8(iy + 0); // BUG: never applies the +16 bias
  const anchor = m.mem.read8(FROG_POS);
  if (pos < anchor) return; if (((pos - anchor) & 0xff) >= 16) return;
  m.mem.write8(HIT_FLAG, 1); m.mem.write8(GATE, 1);
}

test("EQUAL (crafted): loc_2b58 == oracle on every path", { skip }, () => {
  const entries = [
    entry({ [o(6)]: 0 }), // inactive
    entry({ [o(6)]: 1, [o(4)]: 0x10, [FROG_ROW]: 0x20 }), // wrong row
    entry({ [o(6)]: 1, [o(4)]: 0x10, [FROG_ROW]: 0x12, [o(5)]: 0, [s(0)]: 0x50, [FROG_POS]: 0x48 }), // hit, dir 0
    entry({ [o(6)]: 1, [o(4)]: 0x10, [FROG_ROW]: 0x12, [o(5)]: 0x80, [s(0)]: 0x40, [FROG_POS]: 0x48 }), // hit, dir 1 (bias)
    entry({ [o(6)]: 1, [o(4)]: 0x10, [FROG_ROW]: 0x12, [o(5)]: 0, [s(0)]: 0x40, [FROG_POS]: 0x48 }), // below (borrow) miss
    entry({ [o(6)]: 1, [o(4)]: 0x10, [FROG_ROW]: 0x12, [o(5)]: 0, [s(0)]: 0x60, [FROG_POS]: 0x48 }), // too-far miss
    entry({ [o(6)]: 1, [o(4)]: 0x10, [FROG_ROW]: 0x12, [o(5)]: 0, [s(0)]: 0x58, [FROG_POS]: 0x48 }), // window==16 (no hit)
    entry({ [o(6)]: 1, [o(4)]: 0x10, [FROG_ROW]: 0x12, [o(5)]: 0, [s(0)]: 0x57, [FROG_POS]: 0x48 }), // window==15 (hit)
  ];
  assert.ok(entries.length > 0, "vacuous: no crafted entries");
  for (const e of entries) assert.equal(ramDiff(loc_2b58, e), null, "a crafted entry diverged");
  assert.ok(ramDiff(brokenNoOp, entries[2]), "vacuous: oracle wrote nothing on the hit path");
  console.log(`  EQUAL: ${entries.length} crafted paths, loc_2b58 == oracle`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const e = entry(HIT_DIR1);
  assert.ok(ramDiff(brokenNoOp, e), "the no-op twin escaped");
  assert.ok(ramDiff(brokenSkipGate, e), "the skip-gate twin escaped");
  assert.ok(ramDiff(brokenNoBias, e), "the no-bias twin escaped");
  console.log("  TEETH: no-op, skip-gate, no-bias all caught");
});
