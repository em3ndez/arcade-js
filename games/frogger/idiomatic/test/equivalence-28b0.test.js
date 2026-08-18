// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepDiveFrameCounter — memory-equivalent to the frozen oracle at ROM 0x28B0. Ticks a dive counter
 * (cell address = live-in HL): when drained to 0, reload it from the seed cell 0x8146; otherwise
 * decrement it. GATE: crafted-entry. Branches: drained (reload) and non-zero (decrement), plus a run on
 * a DIFFERENT counter cell to prove the address is the live-in. RAM compared, stack masked. Teeth: no-op,
 * a decrement twin, a wrong-reload-source twin; positive controls assert reload and decrement land.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, STUBS } from "./_bootSetup.js";
import { stepDiveFrameCounter as cand } from "../stepDiveFrameCounter.js";
import { loc_28b0 as oracle } from "../../translated/loc_287e.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const SEED = 0x8146, C7 = 0x8147, ALT = 0x814e;

const drained = () => craft((mem, m) => { mem[C7] = 0; mem[SEED] = 0x40; m.regs.hl = C7; });
const nonZero = () => craft((mem, m) => { mem[C7] = 0x05; mem[SEED] = 0x40; m.regs.hl = C7; });
const altCell = () => craft((mem, m) => { mem[ALT] = 0; mem[SEED] = 0x18; mem[C7] = 0x99; m.regs.hl = ALT; });

test("EQUAL (crafted): stepDiveFrameCounter == oracle on reload/decrement/other-cell", { skip }, () => {
  for (const [name, mk] of [["drained-reload", drained], ["non-zero-dec", nonZero], ["alt-cell-reload", altCell]]) {
    assert.equal(ramDiff(oracle, cand, mk()), null, `the ${name} path diverged`);
  }
  let a = drained(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[C7], 0x40, "control: drained counter reloads from 0x8146");
  a = nonZero(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[C7], 0x04, "control: non-zero counter decrements");
  a = altCell(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[ALT], 0x18, "control: the live-in address (0x814e) is the one reloaded");
  console.log("  EQUAL: reload 0->0x40, dec 5->4, live-in cell reload; controls asserted");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const decTwin = (m, c = m.regs.hl) => { m.mem8[c] = (m.mem8[c] - 2) & 0xff; }; // decrements by 2
  const wrongSrc = (m, c = m.regs.hl) => { if (m.mem8[c] === 0) m.mem8[c] = m.mem8[C7]; else m.mem8[c] = (m.mem8[c] - 1) & 0xff; }; // reloads from wrong cell
  assert.ok(ramDiff(oracle, noOp, nonZero()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, decTwin, nonZero()), "dec-by-2 twin escaped");
  assert.ok(ramDiff(oracle, wrongSrc, altCell()), "wrong-reload-source twin escaped");
  console.log("  TEETH: no-op, dec-by-2, wrong-reload-source all caught");
});
