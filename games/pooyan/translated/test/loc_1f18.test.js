// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_1f18 (ROM 0x1f18, Pooyan) -- timer/round HUD updater.
 *
 * Main path: the 7 word slots at 0x89e7 are all zero (no early ret nz); timer 0x8901 = 3 (< 10) so
 * the tens digit C = 0 and jr c reaches loc_1f4e; C == 0 so the round-glyph branch runs: BCD-convert
 * round 0x8907+1 = 2, bit4 clear -> table 0x1fda, blit via loc_1f8c, memset via rst 0x10, copy timer
 * to 0x8743, clear A, then the shared tail (loc_0c45 render + loc_1f8c blit) and ret. Full pcSeq
 * (visiting call targets 0x1f8c/0x0010/0x0c45) + T-state golden. Also an EARLY-RET path (a nonzero
 * slot -> ret nz at 0x1f20). The mock's `call` POPS the pushed return, so a missing push16 desyncs SP.
 * MUTATION tooth: the first `call 0x1f8c` mis-charged 10T (not 17T) is caught. POSITIVE CONTROL
 * performed: deleting `m.push16(0x1f6e)` before that call desyncs the stack and the test fails; restored.
 *
 * Run: node --test games/pooyan/translated/test/loc_1f18.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1f18 } from "../loc_1f18.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1f18, pcSeq: [],
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
    // Callee `ret` pops the return address the call site pushed; a missing push16 then desyncs SP.
    // No callee register outputs are consumed by loc_1f18, so a pure pop is faithful here.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_1f18 main: slots clear, timer<10, C==0 -> round-glyph branch + shared tail", () => {
  const m = makeMachine();
  seatCaller(m);
  // 0x89e7..0x89ee already zero -> the 7-slot scan falls through (no ret nz)
  m.mem.write8(0x8901, 0x03); // timer < 10 -> tens digit C = 0
  m.mem.write8(0x8907, 0x01); // round -> B = round+1 = 2

  loc_1f18(m);

  const check = [];
  for (let i = 0; i < 6; i++) check.push(0x1f1e, 0x1f1f, 0x1f20, 0x1f21, 0x1f1d);
  check.push(0x1f1e, 0x1f1f, 0x1f20, 0x1f21, 0x1f23);
  const expected = [
    0x1f1b, 0x1f1d,
    ...check,
    0x1f25, 0x1f27, 0x1f28, 0x1f2a, 0x1f4e,           // divide loop, 1 iter, jr c taken
    0x1f4f, 0x1f50, 0x1f52, 0x1f55, 0x1f57, 0x1f58, 0x1f59,
    0x1f5b, 0x1f5c, 0x1f59, 0x1f5b, 0x1f5c, 0x1f5e,   // BCD loop, B=2
    0x1f61, 0x1f63, 0x1f65, 0x1f68, 0x1f6b,
    0x1f8c,                                           // call 0x1f8c target
    0x1f70, 0x1f72,
    0x0010,                                           // rst 0x10 target
    0x1f76, 0x1f79, 0x1f7a,
    0x1f7d,
    0x0c45,                                           // call 0x0c45 target
    0x1f83,
    0x1f8c,                                           // second call 0x1f8c target
    CALLER_RET,
  ];

  assert.equal(m.tstates, 585, "main-path T-state total");
  assert.deepEqual(m.pcSeq, expected, "step boundaries match the ROM bytes");
  assert.equal(m.pc, CALLER_RET, "final ret to seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound (every push16 matched a callee ret)");
  assert.deepEqual(m.calls, [0x1f8c, 0x0010, 0x0c45, 0x1f8c], "loc_1f8c, rst 0x10, loc_0c45, loc_1f8c");
  assert.equal(m.mem.read8(0x8743), 0x03, "timer copied to 0x8743");
  assert.equal(m.regs.de, 0x1fda, "bit4 clear -> glyph table 0x1fda");
  assert.equal(m.regs.a, 0x00, "A cleared by xor a at 0x1f79");
});

test("loc_1f18 early ret: a nonzero slot -> ret nz at 0x1f20", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x89e7, 0x05); // first slot nonzero -> or (hl) nonzero -> ret nz on iter1

  loc_1f18(m);

  assert.equal(m.tstates, 10 + 7 + 7 + 6 + 7 + 11, "ld hl + ld b + ld a,(hl) + inc hl + or(hl) + ret nz");
  assert.deepEqual(m.pcSeq, [0x1f1b, 0x1f1d, 0x1f1e, 0x1f1f, 0x1f20, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET, "ret nz to caller");
  assert.equal(m.regs.sp, 0x8780, "stack unwound");
  assert.deepEqual(m.calls, [], "no work done");
});

test("loc_1f18 MUTATION: first `call 0x1f8c` mis-charged 10T (not 17T) is caught", () => {
  const m = makeMachine();
  let seen = false;
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => {
    // only the FIRST visit to 0x1f8c (0x1f6b call) is mis-charged
    if (nextAddr === 0x1f8c && !seen) { seen = true; return realStep(nextAddr, 10); }
    return realStep(nextAddr, cycles);
  };
  seatCaller(m);
  m.mem.write8(0x8901, 0x03);
  m.mem.write8(0x8907, 0x01);

  loc_1f18(m);

  assert.equal(m.tstates, 578, "mutation loses 7 T (17 -> 10)");
  assert.throws(
    () => assert.equal(m.tstates, 585, "main-path T-state total"),
    /585/,
    "the 585-T golden must fail on the mutant",
  );
});
