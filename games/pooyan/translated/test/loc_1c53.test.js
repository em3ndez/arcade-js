// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for translated loc_1c53 (ROM 0x1c53, Pooyan) -- the per-frame object driver. Frame
// parity (0x8907 bit0) selects loc_64e2 (even) or loc_68f8 (odd); both converge on loc_02ef.
//
// The mock's `call` POPS the return the call site pushed (models the callee's `ret`); a call site
// missing its push16 desyncs the stack and the final ret pops garbage -- the stack tooth.
//
// Run: node --test games/pooyan/translated/test/loc_1c53.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1c53 } from "../loc_1c53.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1c53, pcSeq: [],
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
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_1c53 Path even: 0x8907 bit0=0 -> loc_64e2, jr, loc_02ef, ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x02); // bit0 clear

  loc_1c53(m);

  assert.equal(m.tstates, 13 + 7 + 7 + 17 + 12 + 17 + 10, "even-frame T total");
  assert.deepEqual(m.pcSeq, [0x1c56, 0x1c58, 0x1c5a, 0x64e2, 0x1c62, 0x02ef, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET, "ret to seated caller");
  assert.deepEqual(m.calls, [0x64e2, 0x02ef]);
  assert.equal(m.regs.sp, 0x8780, "stack back to baseline");
});

test("loc_1c53 Path odd: 0x8907 bit0=1 -> jr nz, loc_68f8, loc_02ef, ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x01); // bit0 set

  loc_1c53(m);

  assert.equal(m.tstates, 13 + 7 + 12 + 17 + 17 + 10, "odd-frame T total");
  assert.deepEqual(m.pcSeq, [0x1c56, 0x1c58, 0x1c5f, 0x68f8, 0x02ef, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [0x68f8, 0x02ef]);
  assert.equal(m.regs.sp, 0x8780, "stack back to baseline");
});

test("loc_1c53 MUTATION: ld a,(0x8907) mischarged 12T (not 13T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x1c56 ? 12 : cycles);
  seatCaller(m);
  m.mem.write8(0x8907, 0x02);

  loc_1c53(m);

  const golden = 13 + 7 + 7 + 17 + 12 + 17 + 10;
  assert.equal(m.tstates, golden - 1, "mutation loses 1 T");
  assert.throws(() => assert.equal(m.tstates, golden, "even-frame T total"), /even-frame/);
});
