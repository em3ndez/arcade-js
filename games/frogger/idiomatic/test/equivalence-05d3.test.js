// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_05d3 — memory-equivalent to the frozen oracle at ROM 0x05D3.
 * GATE: real-state capture. Plain attract NEVER dispatches this routine in 15000 frames (it is one of
 * the 0x0066 NMI attract-state-machine tails, 0x0271/0x028f), so — unlike the reference 0x0766 gate —
 * there is no self-dispatch to hook. Instead we harvest real attract machine STATES via a
 * high-frequency neighbour (0x0028, ~12k dispatches) and drive loc_05d3 directly on each. That is a
 * valid equivalence test because loc_05d3 takes NO register live-in — it only stores seven fixed
 * constants — so a real attract state is as representative as a real dispatch would be.
 *
 * LIVE-OUT: memory-only (registers are not live-out: loc_0066 returns to epilogue() at both sites
 * without reading A), so RAM is compared, not registers or SP. Teeth: three broken twins.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { loc_05d3 } from "../loc_05d3.js";
import { loc_05d3 as oracle } from "../../translated/loc_05d3.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const HARVEST = 0x0028; // high-frequency attract dispatch, used only to snapshot real states
const CAP = 150;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

let captured = null;
function capture() {
  if (captured) return captured;
  const entries = [];
  const real = TRANSLATED.get(HARVEST);
  const m = makeMachine(new Map([[HARVEST, (mm) => {
    if (entries.length < CAP) entries.push(mm.clone());
    return real(mm);
  }]]));
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the capture run stopped early: ${m.stoppedBy}`);
  captured = entries;
  return captured;
}

// null == RAM-equivalent. Memory-only live-out: compare RAM, not registers or SP.
function ramDiff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

// broken twins, each writing wrong RAM the diff must catch.
function brokenNoOp() {}
function brokenWrongFlag(m) {
  const { mem } = m;
  mem.write8(0x826d, 0x01); mem.write8(0x825a, 0x01); mem.write8(0x83cd, 0x01);
  mem.write8(0x825b, 0x00); mem.write8(0x83ea, 0x00);
  mem.write8(0x8297, 0xff); mem.write8(0x8298, 0x41); // 0x40 -> 0x41
}
function brokenMissingWrite(m) {
  const { mem } = m;
  mem.write8(0x826d, 0x01); mem.write8(0x825a, 0x01); mem.write8(0x83cd, 0x01);
  mem.write8(0x825b, 0x00); mem.write8(0x83ea, 0x00);
  mem.write8(0x8297, 0xff); // drops the (0x8298)=0x40 store
}

test("CAPTURE: oracle == rewrite on every real attract state", { skip }, () => {
  const entries = capture();
  assert.ok(entries.length > 0, "vacuous: no attract states were harvested");
  for (const e of entries) assert.equal(ramDiff(loc_05d3, e), null, "a captured machine diverged");
  console.log(`  CAPTURE: ${entries.length} states, oracle == rewrite`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const e = capture()[0];
  assert.ok(e, "no capture to test teeth against");
  assert.ok(ramDiff(brokenNoOp, e), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongFlag, e), "the wrong-flag twin escaped");
  assert.ok(ramDiff(brokenMissingWrite, e), "the missing-write twin escaped");
  console.log("  TEETH: no-op, wrong-flag, missing-write all caught");
});
