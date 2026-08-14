// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_269a — memory-equivalent to the frozen oracle at ROM 0x269A.
 * GATE: crafted-entry. The 4-byte block (0x805C-0x805F) already reads zero in attract, so a plain
 * capture would make the clear vacuous; a post-boot attract clone is pre-dirtied so all four
 * zero-writes are observable. loc_269a takes no register live-in and its live-out is memory-only,
 * so registers/SP are not compared. Teeth: three broken twins (no-op, short clear, wrong value).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_269a } from "../loc_269a.js";
import { loc_269a as oracle } from "../../translated/loc_269a.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const BLOCK = 0x805c;
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

// A post-boot clone with the block pre-dirtied so the clear is observable.
function dirtyEntry() {
  const e = seedMachine().clone();
  for (let i = 0; i < DIRTY.length; i++) e.mem8[(BLOCK + i) & 0xffff] = DIRTY[i];
  return e;
}

function ramDiff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

// broken twins.
function brokenNoOp() {}
function brokenShort(m) { for (let i = 0; i < 3; i++) m.mem8[(BLOCK + i) & 0xffff] = 0; } // misses 0x805F
function brokenWrongValue(m) { for (let i = 0; i < 4; i++) m.mem8[(BLOCK + i) & 0xffff] = 1; } // clears to 1

test("EQUAL (crafted): loc_269a == oracle", { skip }, () => {
  const e = dirtyEntry();
  assert.equal(ramDiff(loc_269a, e), null, "the crafted entry diverged");
  console.log("  EQUAL: loc_269a == oracle on the pre-dirtied block");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const e = dirtyEntry();
  assert.ok(ramDiff(brokenNoOp, e), "the no-op twin escaped");
  assert.ok(ramDiff(brokenShort, e), "the short-clear twin escaped");
  assert.ok(ramDiff(brokenWrongValue, e), "the wrong-value twin escaped");
  console.log("  TEETH: no-op, short-clear, wrong-value all caught");
});
