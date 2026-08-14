// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2856 — memory-equivalent to the frozen oracle at ROM 0x2856.
 * GATE: crafted-entry. Attract never dispatches this conditional clear (probe: 0 dispatches over
 * ENTRY_FRAMES), so a post-boot attract machine is cloned, the play-mode cell (0x83FE) poked to each
 * mode, and the five target cells dirtied so the zeroing is observable. Both callers reload HL right
 * after the call and read no register the routine leaves, so LIVE-OUT is memory-only and registers/SP
 * are not compared. No push/pop, so no dead stack scratch. Teeth: three broken twins, one an arm twin
 * that ignores the mode guard and so writes on a mode the oracle leaves untouched.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_2856 } from "../loc_2856.js";
import { loc_2856 as oracle } from "../../translated/loc_2856.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const MODE_CELL = 0x83fe;
const CELLS = [0x814f, 0x814e, 0x8145, 0x8146, 0x8147];
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

// A post-boot machine with the play mode poked and the five cells dirtied so the clear is observable.
function entryWithMode(mode) {
  const e = seedMachine().clone();
  e.mem8[MODE_CELL] = mode;
  let v = 0x51;
  for (const c of CELLS) e.mem8[c] = v++;
  return e;
}

// null == RAM-equivalent. Memory-only live-out: compare RAM, not registers or SP.
function ramDiff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

const MODES = [0, 1, 2, 3, 0xff]; // the clearing mode (2), plus modes that must leave the cells alone

function brokenNoOp() {}
function brokenWrongValue(m) { // clears in mode 2 but writes 1 instead of 0
  const { mem8 } = m;
  if (mem8[MODE_CELL] !== 2) return;
  mem8[0x814f] = 1; for (const c of [0x814e, 0x8145, 0x8146, 0x8147]) mem8[c] = 0;
}
function brokenNoGuard(m) { // clears regardless of mode -> writes when the oracle would not
  const { mem8 } = m;
  for (const c of CELLS) mem8[c] = 0;
}

test("EQUAL (crafted): loc_2856 == oracle on every mode path", { skip }, () => {
  const entries = MODES.map(entryWithMode);
  assert.ok(entries.length > 0, "vacuous: no crafted entries");
  for (const e of entries) assert.equal(ramDiff(loc_2856, e), null, "a crafted entry diverged");
  assert.ok(ramDiff(brokenNoOp, entryWithMode(2)), "vacuous: oracle wrote nothing in mode 2");
  console.log(`  EQUAL: ${entries.length} crafted mode paths, loc_2856 == oracle`);
});

test("TEETH: broken twins are caught across the clear and the guard", { skip }, () => {
  assert.ok(ramDiff(brokenNoOp, entryWithMode(2)), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongValue, entryWithMode(2)), "the wrong-value twin escaped");
  assert.ok(ramDiff(brokenNoGuard, entryWithMode(1)), "the no-guard twin escaped");
  console.log("  TEETH: no-op, wrong-value, no-guard all caught");
});
