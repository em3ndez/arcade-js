// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for translated loc_64fb (ROM 0x64fb, Pooyan) -- the 0x8c78 fountain-record state
// dispatcher. Reads state (ix+2), pushes inline table base 0x64ff, tail-dispatches into loc_0028.
// The mock's `call` pops once -- modelling loc_0028's own `pop hl` of the table base -- so after the
// dispatch SP sits back at the caller-ret level (0x877e) with the caller's return still seated.
//
// Run: node --test games/pooyan/translated/test/loc_64fb.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_64fb } from "../loc_64fb.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x64fb, pcSeq: [],
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

test("loc_64fb: reads (ix+2), pushes table base 0x64ff, tails into loc_0028; 30 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8c78;
  m.mem.write8(0x8c7a, 0x02); // (ix+2) = state selector

  loc_64fb(m);

  assert.equal(m.tstates, 19 + 11, "T = ld a,(ix+d) 19 + rst 11");
  assert.equal(m.regs.a, 0x02, "A = state (ix+2)");
  assert.deepEqual(m.pcSeq, [0x64fe, 0x0028]);
  assert.equal(m.pc, 0x0028, "tail into the rst-0x28 trampoline");
  assert.deepEqual(m.calls, [0x0028]);
  assert.equal(m.regs.sp, 0x877e, "table base consumed by loc_0028's pop; caller ret still seated");
  assert.equal(m.ram[0x877c] | (m.ram[0x877d] << 8), 0x64ff, "pushed inline table base 0x64ff");
});

test("loc_64fb MUTATION: ld a,(ix+d) mischarged 15T (not 19T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x64fe ? 15 : c);

  loc_64fb(m);

  assert.notEqual(m.tstates, 30, "golden 30 T catches the mischarge");
});
