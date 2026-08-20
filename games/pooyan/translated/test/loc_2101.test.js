// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_2101 (ROM 0x2101, Pooyan) -- the boot-frontier sub-dispatch:
 * `call 0x2778; call 0x210b; call 0x2157; ret`. Three plain calls in sequence, then ret.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling each callee's `ret`), so a
 * call site that dropped its push16 desyncs the stack and the final ret pops the wrong word -- the
 * balance assertion has teeth. Single straight-line path: pcSeq visits the three call TARGETS then the
 * seated caller return. T=61 (17*3 + 10). MUTATION: mis-charge the first call 10T (not 17) -> caught.
 *
 * Run: node --test games/pooyan/translated/test/loc_2101.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_2101 } from "../loc_2101.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x2101, pcSeq: [],
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
    // The callee's `ret` pops the return address loc_2101 pushed at the call site. loc_2778/210b/2157
    // clobber registers loc_2101 does not read afterward, so only the pop needs modelling.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_2101: three calls then ret to the seated caller", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_2101(m);

  assert.equal(m.tstates, 61, "17*3 calls + 10 ret");
  assert.deepEqual(m.pcSeq, [0x2778, 0x210b, 0x2157, CALLER_RET], "visits the three targets then rets");
  assert.equal(m.pc, CALLER_RET, "ret lands on the seated caller");
  assert.deepEqual(m.calls, [0x2778, 0x210b, 0x2157]);
  // STACK TOOTH: every push16 matched a callee ret pop, and the final ret consumed CALLER_RET, so the
  // stack fully unwinds. A dropped push16 would leave SP off by 2 and the ret would pop garbage.
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
});

test("loc_2101 MUTATION: first call mis-charged 10T (not 17T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x2778 ? 10 : cycles);
  seatCaller(m);

  loc_2101(m);

  assert.equal(m.tstates, 54, "mutation loses 7 T (17 -> 10)");
  assert.throws(() => assert.equal(m.tstates, 61, "golden"), /61/, "the 61-T golden must fail on the mutant");
});
