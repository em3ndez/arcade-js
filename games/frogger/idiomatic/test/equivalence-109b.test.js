// SPDX-License-Identifier: GPL-3.0-only
/**
 * equivalence-109b — crafted-entry gate: renderFrogAnimArm3 vs the frozen oracle at ROM 0x109B. Arm 3
 * loads its row-advance / row-count / column-index from the lane block (0x8279..0x827B), points the
 * cursors + pattern pointers, stashes the row-advance at 0x81B1 and the tile source at 0x8001, then
 * falls through into the still-translated render loop 0x0FF1. Both sides are run with 0x0FF1 stubbed so
 * the RAM diff isolates arm 3's setup writes. Teeth: a no-op and a twin that skips the 0x81B1 stash
 * (both must diff); positive control that 0x81B1 and 0x8001 actually change. Live-out memory-only.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft } from "./_frogHop.js";
import { renderFrogAnimArm3 as cand } from "../renderFrogAnimArm3.js";
import { loc_109b as oracle } from "../../translated/loc_1058.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const STACK_LO = 0x87e0, STACK_HI = 0x8800;
const RENDER_LOOP = 0x0ff1;
const BLOCK = 0x8270 + 9, ROWADV = 0x81b1, SRC_PTR = 0x8001;

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

const seeded = () => craft((mem) => { mem[BLOCK] = 0x11; mem[BLOCK + 1] = 3; mem[BLOCK + 2] = 5; mem[ROWADV] = 0; mem[SRC_PTR] = 0; mem[SRC_PTR + 1] = 0; });

test("EQUAL (crafted): renderFrogAnimArm3 == oracle on the arm-3 setup", { skip }, () => {
  assert.equal(diff(seeded()), null, "arm-3 setup diverged");
  const e = seeded(); const beforeAdv = e.mem8[ROWADV], beforeSrc = e.mem16[SRC_PTR];
  const a = e.clone(); const saved = a.routines.get(RENDER_LOOP); a.routines.set(RENDER_LOOP, () => {});
  oracle(a); a.routines.set(RENDER_LOOP, saved);
  assert.equal(a.mem8[ROWADV], 0x11, "vacuous: row-advance never stashed");
  assert.equal(a.mem16[SRC_PTR], 0x1453, "vacuous: tile source never stashed");
  console.log(`  EQUAL: rowadv ${beforeAdv}->${a.mem8[ROWADV]}, src 0x${beforeSrc.toString(16)}->0x${a.mem16[SRC_PTR].toString(16)}`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const skipRowAdv = (m) => { m.regs.a = m.mem8[BLOCK]; m.mem16[SRC_PTR] = 0x1453; }; // omits mem8[0x81b1]=A
  assert.ok(diff(seeded(), noOp), "no-op twin escaped");
  assert.ok(diff(seeded(), skipRowAdv), "skip-rowadv twin escaped");
  console.log("  TEETH: no-op and skip-rowadv both caught");
});
