// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearCollisionSpriteBlock — memory-equivalent to the frozen oracle at ROM 0x27BC.
 * GATE: crafted-entry. Runs only on the death/goal path (attract doesn't reach it within ENTRY_FRAMES),
 * so a post-boot clone is pre-dirtied on all five touched cells to make every zero-write observable.
 * Live-out is memory-only, so registers/SP are not compared. Teeth: four broken twins, incl. the
 * near-sibling loc_27de which clears the block but leaves the latch set.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { clearCollisionSpriteBlock } from "../clearCollisionSpriteBlock.js";
import { loc_27bc as oracle } from "../../translated/loc_27b3.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const BLOCK = 0x8040;   // fly/goal sprite block base (FLY_SPRITE_X)
const LATCH = 0x8135;   // collision latch, zeroed only by 0x27bc (not by the sibling 0x27de)
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

// A post-boot clone with the block AND the latch pre-dirtied so all five clears are observable.
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
function brokenMissLatch(m) { for (let i = 0; i < 4; i++) m.mem8[(BLOCK + i) & 0xffff] = 0; } // sibling 0x27de: leaves 0x8135
function brokenShort(m) { for (let i = 0; i < 3; i++) m.mem8[(BLOCK + i) & 0xffff] = 0; m.mem8[LATCH] = 0; } // misses 0x8043
function brokenWrongValue(m) { for (let i = 0; i < 4; i++) m.mem8[(BLOCK + i) & 0xffff] = 1; m.mem8[LATCH] = 1; } // clears to 1

test("EQUAL (crafted): clearCollisionSpriteBlock == oracle", { skip }, () => {
  const e = dirtyEntry();
  assert.equal(ramDiff(clearCollisionSpriteBlock, e), null, "the crafted entry diverged");
  // non-vacuous: the oracle actually mutates RAM on this entry.
  assert.ok(ramDiff(brokenNoOp, e), "vacuous: oracle wrote nothing");
  console.log("  EQUAL: clearCollisionSpriteBlock == oracle on the pre-dirtied block + latch");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const e = dirtyEntry();
  assert.ok(ramDiff(brokenNoOp, e), "the no-op twin escaped");
  assert.ok(ramDiff(brokenMissLatch, e), "the miss-latch (0x27de) twin escaped");
  assert.ok(ramDiff(brokenShort, e), "the short-clear twin escaped");
  assert.ok(ramDiff(brokenWrongValue, e), "the wrong-value twin escaped");
  console.log("  TEETH: no-op, miss-latch, short-clear, wrong-value all caught");
});
