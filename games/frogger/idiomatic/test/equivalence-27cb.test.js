// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_27cb — memory-equivalent to the frozen oracle at ROM 0x27CB.
 * GATE: crafted-entry. Attract never dispatches this block-arm (probe: 0 dispatches over
 * ENTRY_FRAMES), so a post-boot attract machine is cloned and the lead byte poked into register B
 * (the routine's one live-in, which the callers set before calling). The four-cell block and the arm
 * cell are pre-dirtied so every write is observable. LIVE-OUT is memory-only: all five callers reload
 * A (xor a) right after the call and read no register the routine leaves, so registers/SP are not
 * compared. The routine has no push/pop, so there is no dead stack scratch to exclude. Teeth: three
 * broken twins the RAM diff catches, one an arm twin that skips the arm-cell write.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_27cb } from "../loc_27cb.js";
import { loc_27cb as oracle } from "../../translated/loc_27cb.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const BLOCK_BASE = 0x8040;
const ARM_CELL = 0x8340;
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

// A post-boot machine with the lead byte in B and the target cells dirtied so the fill is observable.
function entryWithLead(lead) {
  const e = seedMachine().clone();
  e.regs.b = lead;
  for (let i = 0; i < 4; i++) e.mem8[(BLOCK_BASE + i) & 0xffff] = 0xee;
  e.mem8[ARM_CELL] = 0xee;
  return e;
}

// null == RAM-equivalent, running both sides from the same lead byte. Memory-only live-out.
function ramDiff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

const LEADS = [0x18, 0x48, 0x78, 0xa8, 0xd8, 0, 0xff]; // the five real caller values, plus edges

function brokenNoOp() {}
function brokenWrongArm(m, lead = m.regs.b) { // correct block, wrong arm value
  const { mem8 } = m;
  mem8[BLOCK_BASE] = lead; mem8[BLOCK_BASE + 1] = 25; mem8[BLOCK_BASE + 2] = 3; mem8[BLOCK_BASE + 3] = 16;
  mem8[ARM_CELL] = 161;
}
function brokenNoArm(m, lead = m.regs.b) { // fills the block but never arms the cell
  const { mem8 } = m;
  mem8[BLOCK_BASE] = lead; mem8[BLOCK_BASE + 1] = 25; mem8[BLOCK_BASE + 2] = 3; mem8[BLOCK_BASE + 3] = 16;
}

test("EQUAL (crafted): loc_27cb == oracle on every lead byte", { skip }, () => {
  const entries = LEADS.map(entryWithLead);
  assert.ok(entries.length > 0, "vacuous: no crafted entries");
  for (const e of entries) assert.equal(ramDiff(loc_27cb, e), null, "a crafted entry diverged");
  assert.ok(ramDiff(brokenNoOp, entryWithLead(0x18)), "vacuous: oracle wrote nothing");
  console.log(`  EQUAL: ${entries.length} crafted lead bytes, loc_27cb == oracle`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const e = entryWithLead(0x48);
  assert.ok(ramDiff(brokenNoOp, e), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongArm, e), "the wrong-arm-value twin escaped");
  assert.ok(ramDiff(brokenNoArm, e), "the no-arm twin escaped");
  console.log("  TEETH: no-op, wrong-arm-value, no-arm all caught");
});
