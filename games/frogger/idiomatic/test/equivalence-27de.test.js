// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearFlySpriteBlock — memory-equivalent to the frozen oracle at ROM 0x27DE.
 * GATE: crafted-entry (goal-sprite timing arm only). A post-boot clone is pre-dirtied on the four block
 * cells AND the collision latch to make every write observable; live-out is memory-only (the oracle
 * walks HL to the block's last cell, replayed at the caller). Teeth: the near-sibling over-clear that
 * ALSO zeroes the latch — the 0x27bc behaviour 0x27de must NOT do — plus no-op, short, wrong-value.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { clearFlySpriteBlock } from "../clearFlySpriteBlock.js";
import { loc_27de as oracle } from "../../translated/loc_27cb.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const BLOCK = 0x8040;   // fly/goal sprite block base (FLY_SPRITE_X)
const LATCH = 0x8135;   // collision latch, left untouched by 0x27de (zeroed only by the sibling 0x27bc)
const DIRTY = [0x11, 0x22, 0x33, 0x44];
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

// A post-boot clone with the block AND the latch pre-dirtied; a twin that clears the latch is caught.
function dirtyEntry() {
  const e = seedMachine().clone();
  for (let i = 0; i < DIRTY.length; i++) e.mem8[(BLOCK + i) & 0xffff] = DIRTY[i];
  e.mem8[LATCH] = 0x99;
  return e;
}

// null == RAM-equivalent. Memory-only live-out: compare RAM, not registers or SP.
function ramDiff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

// broken twins.
function brokenNoOp() {}
function brokenOverClear(m) { for (let i = 0; i < 4; i++) m.mem8[(BLOCK + i) & 0xffff] = 0; m.mem8[LATCH] = 0; } // sibling 0x27bc: also clears 0x8135
function brokenShort(m) { for (let i = 0; i < 3; i++) m.mem8[(BLOCK + i) & 0xffff] = 0; } // misses 0x8043
function brokenWrongValue(m) { for (let i = 0; i < 4; i++) m.mem8[(BLOCK + i) & 0xffff] = 1; } // clears to 1

test("EQUAL (crafted): clearFlySpriteBlock == oracle", { skip }, () => {
  const e = dirtyEntry();
  assert.equal(ramDiff(clearFlySpriteBlock, e), null, "the crafted entry diverged");
  // non-vacuous: the oracle actually mutates RAM on this entry.
  assert.ok(ramDiff(brokenNoOp, e), "vacuous: oracle wrote nothing");
  console.log("  EQUAL: clearFlySpriteBlock == oracle on the pre-dirtied block; latch left set");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const e = dirtyEntry();
  assert.ok(ramDiff(brokenNoOp, e), "the no-op twin escaped");
  assert.ok(ramDiff(brokenOverClear, e), "the over-clear (0x27bc) twin escaped");
  assert.ok(ramDiff(brokenShort, e), "the short-clear twin escaped");
  assert.ok(ramDiff(brokenWrongValue, e), "the wrong-value twin escaped");
  console.log("  TEETH: no-op, over-clear, short-clear, wrong-value all caught");
});
