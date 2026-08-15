// SPDX-License-Identifier: GPL-3.0-only
/**
 * flagSpriteObjectFrogHitAhead — memory-equivalent to the frozen oracle at ROM 0x2CA8.
 * GATE: crafted-entry. Attract never dispatches this IX sprite-object proximity arm (it runs only in
 * the in-play sprite cluster 0x2B83), so a post-boot attract clone gets IX/IY at a descriptor pair
 * (0x8440 / 0x8048) and cells poked for every branch: inactive, wrong-row, a hit for each direction
 * bit (the +20 / -4 bias paths), the below (borrow) miss, the too-far miss, and both window edges.
 * Live-in IX/IY (preserved) + RAM; LIVE-OUT memory-only (raises 0x8004 and marks (IX+6)). Teeth: four
 * broken twins.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { flagSpriteObjectFrogHitAhead } from "../flagSpriteObjectFrogHitAhead.js";
import { loc_2ca8 as oracle } from "../../translated/loc_2ca8.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const IX = 0x8440;
const IY = 0x8048;
const FROG_ROW = 0x8047;
const FROG_X = 0x8044;
const HIT_FLAG = 0x8004;
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

// null == RAM-equivalent. Memory-only live-out: compare RAM, not registers or SP.
function ramDiff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

// pos = (IY+0) then +20 (dir bit clear) or -4 (dir bit set); hit when 0 <= pos-(0x8044) < 16.
const HIT_DIR0 = { [o(6)]: 1, [o(4)]: 0x20, [FROG_ROW]: 0x20, [o(5)]: 0, [s(0)]: 0x40, [FROG_X]: 0x50 };
const HIT_DIR1 = { [o(6)]: 1, [o(4)]: 0x20, [FROG_ROW]: 0x20, [o(5)]: 0x80, [s(0)]: 0x60, [FROG_X]: 0x58 };

// broken twins.
function brokenNoOp() {}
function brokenWrongHit(m) { // right decision, wrong hit-flag value
  const { mem8, regs } = m;
  const obj = regs.ix, spr = regs.iy;
  if (mem8[(obj + 6) & 0xffff] === 0) return;
  if (mem8[(obj + 4) & 0xffff] !== mem8[FROG_ROW]) return;
  let pos = mem8[(spr + 0) & 0xffff];
  pos = mem8[(obj + 5) & 0xffff] !== 0 ? (pos - 4) & 0xff : (pos + 20) & 0xff;
  if (pos < mem8[FROG_X]) return;
  if (((pos - mem8[FROG_X]) & 0xff) >= 16) return;
  mem8[HIT_FLAG] = 2; mem8[(obj + 6) & 0xffff] = 2; // BUG: hit flag = 2 not 1
}
function brokenNoState(m) { // raises the hit flag but never marks (IX+6)
  const { mem8, regs } = m;
  const obj = regs.ix, spr = regs.iy;
  if (mem8[(obj + 6) & 0xffff] === 0) return;
  if (mem8[(obj + 4) & 0xffff] !== mem8[FROG_ROW]) return;
  let pos = mem8[(spr + 0) & 0xffff];
  pos = mem8[(obj + 5) & 0xffff] !== 0 ? (pos - 4) & 0xff : (pos + 20) & 0xff;
  if (pos < mem8[FROG_X]) return;
  if (((pos - mem8[FROG_X]) & 0xff) >= 16) return;
  mem8[HIT_FLAG] = 1; // BUG: skip (IX+6) = 2
}
function brokenSwapDir(m) { // swaps the +20 / -4 direction adjustment
  const { mem8, regs } = m;
  const obj = regs.ix, spr = regs.iy;
  if (mem8[(obj + 6) & 0xffff] === 0) return;
  if (mem8[(obj + 4) & 0xffff] !== mem8[FROG_ROW]) return;
  let pos = mem8[(spr + 0) & 0xffff];
  pos = mem8[(obj + 5) & 0xffff] !== 0 ? (pos + 20) & 0xff : (pos - 4) & 0xff; // BUG: swapped
  if (pos < mem8[FROG_X]) return;
  if (((pos - mem8[FROG_X]) & 0xff) >= 16) return;
  mem8[HIT_FLAG] = 1; mem8[(obj + 6) & 0xffff] = 2;
}

test("EQUAL (crafted): flagSpriteObjectFrogHitAhead == oracle on every path", { skip }, () => {
  const entries = [
    entry({ [o(6)]: 0 }), // inactive
    entry({ [o(6)]: 1, [o(4)]: 0x20, [FROG_ROW]: 0x21 }), // wrong row
    entry(HIT_DIR0), // hit, dir 0 (+20)
    entry(HIT_DIR1), // hit, dir 1 (-4)
    entry({ [o(6)]: 1, [o(4)]: 0x20, [FROG_ROW]: 0x20, [o(5)]: 0, [s(0)]: 0x20, [FROG_X]: 0x50 }), // below (borrow) miss
    entry({ [o(6)]: 1, [o(4)]: 0x20, [FROG_ROW]: 0x20, [o(5)]: 0, [s(0)]: 0x60, [FROG_X]: 0x50 }), // too-far miss
    entry({ [o(6)]: 1, [o(4)]: 0x20, [FROG_ROW]: 0x20, [o(5)]: 0, [s(0)]: 0x4c, [FROG_X]: 0x50 }), // window==16 (no hit)
    entry({ [o(6)]: 1, [o(4)]: 0x20, [FROG_ROW]: 0x20, [o(5)]: 0, [s(0)]: 0x4b, [FROG_X]: 0x50 }), // window==15 (hit)
  ];
  assert.ok(entries.length > 0, "vacuous: no crafted entries");
  for (const e of entries) assert.equal(ramDiff(flagSpriteObjectFrogHitAhead, e), null, "a crafted entry diverged");
  assert.ok(ramDiff(brokenNoOp, entry(HIT_DIR0)), "vacuous: oracle wrote nothing on the hit path");
  console.log(`  EQUAL: ${entries.length} crafted paths, flagSpriteObjectFrogHitAhead == oracle`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const e0 = entry(HIT_DIR0);
  const e1 = entry(HIT_DIR1);
  assert.ok(ramDiff(brokenNoOp, e0), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongHit, e0), "the wrong-hit-value twin escaped");
  assert.ok(ramDiff(brokenNoState, e0), "the skip-state twin escaped");
  assert.ok(ramDiff(brokenSwapDir, e1), "the swapped-direction twin escaped");
  console.log("  TEETH: no-op, wrong-hit, skip-state, swapped-direction all caught");
});
