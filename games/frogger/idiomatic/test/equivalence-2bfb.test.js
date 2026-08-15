// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2bfb — memory-equivalent to the frozen oracle at ROM 0x2BFB.
 * GATE: crafted-entry. Attract never dispatches this in-play sprite-slot stager (probe: 0 dispatches
 * over ENTRY_FRAMES), so a post-boot attract machine is cloned and pointed at the object record /
 * sprite slot its caller uses (IX=0x8480, IY=0x8058), with the object-state byte poked across the
 * inactive (0) path, every active table index, and the wrapped edge. The IY slot bytes are pre-set to
 * a sentinel so the writes are observable. Live-in is IX/IY (an oracle boundary); live-out is
 * memory-only, so RAM is compared and registers/SP are not. Teeth: three broken RAM twins.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_2bfb } from "../loc_2bfb.js";
import { loc_2bfb as oracle } from "../../translated/loc_2bfb.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const RECORD = 0x8480; // object record base its caller loads into IX
const SLOT = 0x8058;   // sprite slot base its caller loads into IY
const ATTR_TABLE = 0x2cd9;
const STATES = [0, 1, 2, 3, 4, 7, 0x10, 0xff]; // inactive, low indices, and the wrapped edge
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

// A post-boot machine aimed at the object record / sprite slot, with a given object state and
// sentinel slot bytes so any stage is observable (a valid entry: this leaf reads IX/IY + RAM).
function entryWithState(state) {
  const e = seedMachine().clone();
  e.regs.ix = RECORD;
  e.regs.iy = SLOT;
  e.mem8[RECORD + 6] = state;
  e.mem8[RECORD + 5] = 0x0a; // low object flag bits OR'd into the attribute
  e.mem8[SLOT + 1] = 0xee;
  e.mem8[SLOT + 2] = 0xee;
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
function brokenWrongAttr(m) {
  const { regs, mem8 } = m;
  const state = mem8[(regs.ix + 6) & 0xffff];
  if (state === 0) return;
  const attr = mem8[(ATTR_TABLE + state) & 0xffff] | mem8[(regs.ix + 5) & 0xffff];
  mem8[(regs.iy + 1) & 0xffff] = (attr + 1) & 0xff; // BUG: wrong attribute
  mem8[(regs.iy + 2) & 0xffff] = 2;
}
function brokenNoGate(m) {
  const { regs, mem8 } = m;
  const state = mem8[(regs.ix + 6) & 0xffff]; // BUG: stages even an inactive (state 0) object
  const attr = mem8[(ATTR_TABLE + state) & 0xffff] | mem8[(regs.ix + 5) & 0xffff];
  mem8[(regs.iy + 1) & 0xffff] = attr;
  mem8[(regs.iy + 2) & 0xffff] = 2;
}

test("EQUAL (crafted): loc_2bfb == oracle on every object-state path", { skip }, () => {
  const entries = STATES.map(entryWithState);
  for (const e of entries) assert.equal(ramDiff(loc_2bfb, e), null, "a crafted entry diverged");
  // non-vacuous: the no-op twin diverging proves the oracle actually stages on an active state.
  assert.ok(ramDiff(brokenNoOp, entryWithState(3)), "vacuous: oracle wrote nothing on an active state");
  console.log(`  EQUAL: ${entries.length} crafted state paths, loc_2bfb == oracle`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const active = entryWithState(3);
  assert.ok(ramDiff(brokenNoOp, active), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongAttr, active), "the wrong-attr twin escaped");
  assert.ok(ramDiff(brokenNoGate, entryWithState(0)), "the no-gate twin escaped on an inactive object");
  console.log("  TEETH: no-op, wrong-attr, no-gate all caught");
});
