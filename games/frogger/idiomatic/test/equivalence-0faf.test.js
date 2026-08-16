// SPDX-License-Identifier: GPL-3.0-only
/**
 * equivalence-0faf — crafted-entry gate: dispatchFrogAnimationArm vs the frozen oracle at ROM 0x0FAF.
 * The dispatcher reads the anim index (0x8000), follows the ROM pointer table, and tail-jumps the arm.
 * Each arm tail-transfers into the still-translated render loop 0x0FF1, so both sides are run with 0x0FF1
 * stubbed to a no-op: the RAM diff then isolates the arm dispatch + that arm's setup writes. Covers a
 * kept-m.call arm (index 0/2/10) and a dissolved lifted arm (index 1 -> renderFrogAnimArm1, index 6 ->
 * renderFrogAnimArm6). Teeth: a no-op and a wrong-index twin (both must diff); positive control that the
 * arm setup is non-vacuous. Live-out memory-only; stack masked.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft } from "./_frogHop.js";
import { dispatchFrogAnimationArm as cand } from "../dispatchFrogAnimationArm.js";
import { loc_0faf as oracle } from "../../translated/loc_0faf.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const STACK_LO = 0x87e0, STACK_HI = 0x8800;
const ANIM_INDEX = 0x8000, RENDER_LOOP = 0x0ff1, ARM0_ROWADV = 0x81b1, ARM0_BLOCK = 0x8270;

// Both arms tail-transfer into the translated render loop; stub it so the diff isolates the dispatch.
function diff(entry, candFn = cand) {
  const saved = entry.routines.get(RENDER_LOOP);
  entry.routines.set(RENDER_LOOP, () => {});
  try {
    const a = entry.clone(); oracle(a);
    const b = entry.clone(); candFn(b);
    const A = a.dumpState(), B = b.dumpState();
    for (let i = 0; i < Math.min(A.length, B.length); i++) {
      if (A[i] === B[i]) continue;
      const addr = a.stateOffsetToAddr(i);
      if (addr >= STACK_LO && addr < STACK_HI) continue;
      return `0x${addr.toString(16)}: ${A[i]} vs ${B[i]}`;
    }
    return null;
  } finally {
    entry.routines.set(RENDER_LOOP, saved);
  }
}

const at = (idx) => craft((mem) => { mem[ANIM_INDEX] = idx; });

test("EQUAL (crafted): dispatchFrogAnimationArm == oracle on each arm index", { skip }, () => {
  for (const idx of [0, 1, 2, 6, 10]) {
    assert.equal(diff(at(idx)), null, `arm index ${idx} diverged`);
  }
  const e = craft((mem) => { mem[ANIM_INDEX] = 0; mem[ARM0_ROWADV] = 0; mem[ARM0_BLOCK] = 0x11; });
  const a = e.clone();
  const saved = a.routines.get(RENDER_LOOP); a.routines.set(RENDER_LOOP, () => {});
  oracle(a); a.routines.set(RENDER_LOOP, saved);
  const before = e.mem8[ARM0_ROWADV];
  assert.equal(a.mem8[ARM0_ROWADV], 0x11, "vacuous: arm 0 never stamped its row-advance");
  console.log(`  EQUAL: indices 0/1/2/6/10; arm0 rowadv ${before}->${a.mem8[ARM0_ROWADV]}`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongIndex = (m) => { m.mem8[ANIM_INDEX] = 6; return cand(m); };
  assert.ok(diff(at(1), noOp), "no-op twin escaped");
  assert.ok(diff(at(1), wrongIndex), "wrong-index twin escaped");
  console.log("  TEETH: no-op and wrong-index both caught");
});
