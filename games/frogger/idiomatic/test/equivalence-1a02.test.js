// SPDX-License-Identifier: GPL-3.0-only
/**
 * seedObjectAnimationState — memory-equivalent to the frozen oracle at ROM 0x1A02.
 * GATE: crafted-entry. Attract never dispatches this board-init seed (probe: 0 dispatches over
 * ENTRY_FRAMES). It reads no live-in, so a post-boot attract machine is cloned; a second entry
 * pre-dirties the two seed blocks to 0xEE so every seeded cell is observable. Live-out is
 * memory-only, so registers/SP are not compared. Teeth: three broken RAM twins.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { seedObjectAnimationState } from "../seedObjectAnimationState.js";
import { loc_1a02 as oracle } from "../../translated/loc_1a02.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const BLOCK_LO = 0x800c;
const BLOCK_HI = 0x803c;
const CELL_BASE = 0x8021;
const STATE_BASE = 0x800d;
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

function entry() {
  return seedMachine().clone();
}
// Pre-dirty the seed region so every write the routine makes is observable against the oracle.
function dirtyEntry() {
  const e = seedMachine().clone();
  for (let a = BLOCK_LO; a <= BLOCK_HI; a++) e.mem8[a] = 0xee;
  return e;
}

// null == RAM-equivalent. Memory-only live-out: compare RAM, not registers or SP.
function ramDiff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

const CELL_SEEDS = [6, 6, 5, 5, 5, 5, 4, 4, 5, 5, 7, 7, 6, 6];
const STATE_SEEDS = [2, 2, 5, 5, 2, 2, 2, 2, 5, 5];

function brokenNoOp() {}
function brokenWrongValue(m) {
  const { mem8 } = m;
  for (let i = 0; i < CELL_SEEDS.length; i++) mem8[(CELL_BASE + 2 * i) & 0xffff] = i === 0 ? 9 : CELL_SEEDS[i]; // BUG: first cell
  for (let i = 0; i < STATE_SEEDS.length; i++) mem8[(STATE_BASE + 2 * i) & 0xffff] = STATE_SEEDS[i];
}
function brokenShortCount(m) {
  const { mem8 } = m;
  for (let i = 0; i < CELL_SEEDS.length; i++) mem8[(CELL_BASE + 2 * i) & 0xffff] = CELL_SEEDS[i];
  for (let i = 0; i < 9; i++) mem8[(STATE_BASE + 2 * i) & 0xffff] = STATE_SEEDS[i]; // BUG: one cell short
}

test("EQUAL (crafted): seedObjectAnimationState == oracle from post-boot and dirtied entries", { skip }, () => {
  const entries = [entry(), dirtyEntry()];
  for (const e of entries) assert.equal(ramDiff(seedObjectAnimationState, e), null, "a crafted entry diverged");
  assert.ok(ramDiff(brokenNoOp, dirtyEntry()), "vacuous: oracle wrote nothing");
  console.log(`  EQUAL: ${entries.length} crafted entries, seedObjectAnimationState == oracle`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const e = dirtyEntry();
  assert.ok(ramDiff(brokenNoOp, e), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongValue, e), "the wrong-value twin escaped");
  assert.ok(ramDiff(brokenShortCount, e), "the short-count twin escaped");
  console.log("  TEETH: no-op, wrong-value, short-count all caught");
});
