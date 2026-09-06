// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_00d8 — crafted-entry equivalence vs the frozen translated oracle at ROM 0x00d8 (the vblank
 * interrupt epilogue). Live-outs are (a) the irq-enable control latch (0x7001 -> io.irqEnable, a board
 * device latch NOT in the state dump, so ramDiff is blind to it) and (b) the six register pairs restored
 * from the stack. EQUAL asserts the io latch AND a regDiff on iy/ix/hl/de/bc/af, plus ramDiff==null to
 * prove no work/video/OBJ RAM is touched. The seed arms the latch OFF and seats distinct stack words so
 * each pop is observable. Teeth: a no-op, a restore-without-rearm (io), a swapped-pair restore (regs),
 * and a RAM scribble (ramDiff). The return-stack window is masked by ramDiff.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { rearmVblankInterruptAndRestoreRegs as cand } from "../rearmVblankInterruptAndRestoreRegs.js";
import { loc_00d8 as oracle } from "../../translated/loc_00d8.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const SCRATCH_RAM = 0x4180; // a plain work-RAM cell for the ramDiff-teeth twin

// Seed the latch OFF, zero the six pairs (sentinels), and lay the stack: the deepest word is the ret PC,
// then af,bc,de,hl,ix,iy so the epilogue pops iy first .. af last.
const entry = () => craft((mem8, m) => {
  mem8[0x7001] = 0; // seed the irq-enable latch OFF so the epilogue's re-arm to 1 is observable
  m.regs.iy = m.regs.ix = m.regs.hl = m.regs.de = m.regs.bc = m.regs.af = 0;
  m.push16(0x9999); // ret PC (deepest; consumed by the epilogue's return, not asserted)
  m.push16(0xbbcc); // -> af (popped last)
  m.push16(0x99aa); // -> bc
  m.push16(0x7788); // -> de
  m.push16(0x5566); // -> hl
  m.push16(0x3344); // -> ix
  m.push16(0x1122); // -> iy (popped first)
});

// The irq-enable live-out is a board latch (not in dumpState); read it off the io device.
function irqAfter(fn, e) {
  const m = e.clone(); m.routines = STUBS; fn(m); return m.mem.io.irqEnable;
}
// The register live-outs are also invisible to ramDiff; snapshot the restored pairs.
function regsAfter(fn, e) {
  const m = e.clone(); m.routines = STUBS; fn(m);
  return { iy: m.regs.iy, ix: m.regs.ix, hl: m.regs.hl, de: m.regs.de, bc: m.regs.bc, af: m.regs.af };
}

const noOp = () => {};
// Restores the pairs correctly but never re-arms the latch — caught only by the io check.
const noArm = (m) => {
  m.regs.iy = m.pop16(); m.regs.ix = m.pop16(); m.regs.hl = m.pop16();
  m.regs.de = m.pop16(); m.regs.bc = m.pop16(); m.regs.af = m.pop16(); m.ret();
};
// Re-arms the latch but restores iy/ix swapped — caught only by the register check.
const swapPair = (m) => {
  const iy = m.pop16(), ix = m.pop16(), hl = m.pop16(), de = m.pop16(), bc = m.pop16(), af = m.pop16();
  m.regs.iy = ix; m.regs.ix = iy; m.regs.hl = hl; m.regs.de = de; m.regs.bc = bc; m.regs.af = af;
  m.mem8[0x7001] = 1; m.ret();
};
const scribble = (m) => { cand(m); m.mem8[SCRATCH_RAM] = m.mem8[SCRATCH_RAM] ^ 0xff; };

test("EQUAL (crafted): loc_00d8 re-arms the latch and restores the pairs like the oracle", { skip }, () => {
  assert.equal(irqAfter(cand, entry()), irqAfter(oracle, entry()), "candidate/oracle irq latch disagree");
  assert.deepEqual(regsAfter(cand, entry()), regsAfter(oracle, entry()), "restored register pairs diverged");
  assert.equal(ramDiff(oracle, cand, entry()), null, "loc_00d8 wrote RAM the oracle did not");
  // non-vacuous positive controls: the oracle really re-arms the latch and pops iy from the stack.
  const a = entry().clone(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem.io.irqEnable, 1, "positive control: oracle did not re-arm the irq latch");
  assert.equal(a.regs.iy, 0x1122, "positive control: oracle did not restore iy from the stack");
  console.log("  EQUAL: irq latch 0->1, six pairs restored, no RAM touched");
});

test("TEETH: broken twins are caught", { skip }, () => {
  assert.notEqual(irqAfter(noOp, entry()), irqAfter(oracle, entry()), "no-op twin escaped (latch)");
  assert.notEqual(irqAfter(noArm, entry()), irqAfter(oracle, entry()), "no-rearm twin escaped (latch)");
  assert.notDeepEqual(regsAfter(noOp, entry()), regsAfter(oracle, entry()), "no-op twin escaped (regs)");
  assert.notDeepEqual(regsAfter(swapPair, entry()), regsAfter(oracle, entry()), "swapped-pair twin escaped (regs)");
  assert.ok(ramDiff(oracle, scribble, entry()), "scribble twin escaped (ramDiff teeth)");
  console.log("  TEETH: no-op + no-rearm (io), no-op + swapped-pair (regs), scribble (ramDiff) all caught");
});
