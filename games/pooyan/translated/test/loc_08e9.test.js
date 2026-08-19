// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_08e9 (ROM 0x08e9, Pooyan) -- attract sub-state 1.
 * Gates on the 0x02ce frame timer via `ret nz`, then verifies two ROM tables by 8-bit
 * sum (0x0859..0x0878 == 0x63; 0x0831..0x0839 == 0xaa -- both seeded here from the real
 * ROM), paints the attribute map (call 0x075d), queues two display commands (rst 0x38),
 * and sets the sub-state at 0x8e51 = 7.
 *
 * Two pinned paths:
 *   A. timer expired (Z on entry, standing in for 0x02ce's result): both checksums pass on
 *      the first attempt, T = 1239 (independently hand-summed and sim-checked), six external
 *      calls in order, DE = 0x060b (after `ld e,0x0b`), 0x8e51 = 7, `ret` to the caller.
 *   B. timer still counting (NZ on entry): `ret nz` bails after the single 0x02ce call,
 *      T = 7 + 17 + 11 = 35, only 0x02ce called, 0x8e51 untouched.
 *
 * TEETH: mis-charge the first `rst 0x38` (11 T) as 7 T. The golden T-state must catch it.
 *
 * Run: node --test games/pooyan/translated/test/loc_08e9.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_08e9 } from "../loc_08e9.js";

const CALLER_RET = 0xabcd;

// Real ROM bytes for the two checksum tables (maincpu.bin).
const TABLE_0859 = [
  0x0d, 0x03, 0x00, 0x00, 0x07, 0x07, 0x07, 0x07, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x0b, 0x0b, 0x0b, 0x0b, 0x07, 0x00, 0x04, 0x00,
]; // 0x0859..0x0878, sum = 0x63
const TABLE_0831 = [0x19, 0x00, 0x0e, 0x11, 0x1f, 0x1f, 0x10, 0x07, 0x1d]; // 0x0831..0x0839, sum = 0xaa

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x08e9, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) {
      regs.sp = (regs.sp - 2) & 0xffff;
      mem.write8(regs.sp, v & 0xff);
      mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
    },
    pop16() {
      const lo = mem.read8(regs.sp);
      const hi = mem.read8((regs.sp + 1) & 0xffff);
      regs.sp = (regs.sp + 2) & 0xffff;
      return lo | (hi << 8);
    },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // FAITHFUL stub: every callee (0x02ce/0x02e3/0x075d/0x0e54, two rst 0x38) is plain-ret and pops
    // the return loc_08e9 pushed (0 T -> tstates counts only loc_08e9's own steps). ret(0) leaves the
    // flags alone, so the pre-set Z (standing in for 0x02ce's result) still drives the `ret nz`.
    // A record-only stub hid the pattern-B leak; the SP-balance assertion + positive control are teeth.
    call(addr) { this.calls.push(addr); this.ret(0); return undefined; },
  };
}

function setup(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
  TABLE_0859.forEach((v, i) => m.mem.write8(0x0859 + i, v));
  TABLE_0831.forEach((v, i) => m.mem.write8(0x0831 + i, v));
}

test("loc_08e9 Path A: timer expired -> checksums pass, sub-state -> 7", () => {
  const m = makeMachine();
  setup(m);
  m.regs.f = 0x40; // Z set: 0x02ce's `ret nz` falls through (timer expired)
  loc_08e9(m);

  assert.equal(m.tstates, 1239, "total T with both checksums passing first attempt");
  assert.equal(m.pc, CALLER_RET, "exits via the final `ret`");
  assert.deepEqual(
    m.calls,
    [0x02ce, 0x02e3, 0x075d, 0x0e54, 0x0038, 0x0038],
    "external calls (incl. both rst 0x38) in order",
  );
  assert.equal(m.mem.read8(0x8e51), 0x07, "sub-state advanced to 7");
  assert.equal(m.regs.de, 0x060b, "DE = 0x060b at the second rst (D held 0x06, E := 0x0b)");
  assert.equal(m.regs.sp, 0x8780, "stack balanced -- pattern-A calls do NOT leak");
});

// POSITIVE CONTROL: the pattern-B bug (a missing push16 before a call) leaks 2 bytes. Swallow the
// timer call's pushed return so 0x02ce's faithful ret pops the wrong word -- SP MUST end unbalanced.
test("loc_08e9 POSITIVE CONTROL: dropping a call's push16 (pattern-B) leaves SP unbalanced", () => {
  const m = makeMachine();
  setup(m);
  m.regs.f = 0x40;
  let dropped = false;
  const realPush = m.push16.bind(m);
  m.push16 = (v) => { if (!dropped && v === 0x08ee) { dropped = true; return; } return realPush(v); };

  loc_08e9(m);

  assert.notEqual(m.regs.sp, 0x8780, "a missing push16 leaks -> SP drifts (the pattern-B defect)");
});

test("loc_08e9 Path B: timer still counting -> `ret nz` bails immediately", () => {
  const m = makeMachine();
  setup(m);
  m.regs.f = 0x00; // NZ: 0x02ce still counting -> ret nz taken
  loc_08e9(m);

  assert.equal(m.tstates, 35, "T = 7 (ld b) + 17 (call 0x02ce) + 11 (ret nz taken)");
  assert.equal(m.pc, CALLER_RET, "returned early");
  assert.deepEqual(m.calls, [0x02ce], "only the timer call ran");
  assert.deepEqual(m.pcSeq, [0x08eb, 0x02ce, 0x08ee, CALLER_RET],
    "boundaries: ld b, step to 0x02ce, faithful ret to 0x08ee, ret nz to caller");
  assert.equal(m.mem.read8(0x8e51), 0x00, "sub-state untouched on the bail path");
});

test("loc_08e9 MUTATION: `call 0x0e54` mis-charged 10T (not 17T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x0e54 ? 10 : cycles);
  setup(m);
  m.regs.f = 0x40;
  loc_08e9(m);

  assert.equal(m.tstates, 1232, "mutation loses 7 T (17 -> 10)");
  assert.throws(
    () => assert.equal(m.tstates, 1239, "total T"),
    /1239/,
    "the golden T-state assertion must fail on the mutant",
  );
});
