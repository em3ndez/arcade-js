// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for translated loc_6822 (ROM 0x6822, Pooyan) -- the 0x8b28 record state dispatcher,
// gated by 0x8afa. Gate zero -> ret z straight to the caller. Gate set -> IX = 0x8ae0+0x48, read
// state (ix+2), push inline table base 0x6834, tail into loc_0028 (whose `pop hl` -- modelled by the
// mock's call-pop -- consumes the table base, leaving the caller ret seated at 0x877e).
//
// Run: node --test games/pooyan/translated/test/loc_6822.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6822 } from "../loc_6822.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x6822, pcSeq: [],
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

test("loc_6822 Path gate-closed: 0x8afa=0 -> ret z to caller", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8afa, 0x00);

  loc_6822(m);

  assert.equal(m.tstates, 13 + 4 + 11, "T = ld a,(nn) + and a + ret z taken");
  assert.deepEqual(m.pcSeq, [0x6825, 0x6826, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET, "ret z to seated caller");
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x8780, "stack back to baseline");
});

test("loc_6822 Path gate-open: 0x8afa!=0 -> IX=0x8b28, dispatch table 0x6834", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8afa, 0x01);
  m.mem.write8(0x8b2a, 0x01); // (0x8ae0+0x48 = 0x8b28) + 2 = state selector

  loc_6822(m);

  assert.equal(m.tstates, 13 + 4 + 5 + 14 + 10 + 15 + 19 + 11, "gate-open T total");
  assert.deepEqual(m.pcSeq, [0x6825, 0x6826, 0x6827, 0x682b, 0x682e, 0x6830, 0x6833, 0x0028]);
  assert.equal(m.pc, 0x0028, "tail into the rst-0x28 trampoline");
  assert.equal(m.regs.ix, 0x8b28, "IX = 0x8ae0 + 0x48");
  assert.equal(m.regs.a, 0x01, "A = state (ix+2)");
  assert.deepEqual(m.calls, [0x0028]);
  assert.equal(m.regs.sp, 0x877e, "table base consumed by loc_0028's pop; caller ret still seated");
  assert.equal(m.ram[0x877c] | (m.ram[0x877d] << 8), 0x6834, "pushed inline table base 0x6834");
});

test("loc_6822 MUTATION: add ix,de mischarged 11T (not 15T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8afa, 0x01);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x6830 ? 11 : c);

  loc_6822(m);

  const golden = 13 + 4 + 5 + 14 + 10 + 15 + 19 + 11;
  assert.equal(m.tstates, golden - 4, "mutation loses 4 T");
  assert.throws(() => assert.equal(m.tstates, golden, "gate-open T total"), /gate-open/);
});
