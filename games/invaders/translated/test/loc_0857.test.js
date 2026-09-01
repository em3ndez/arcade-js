// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_0857 (ROM 0x0857-0x086c): reads input port 1 and dispatches on two bits.
// bit1 set -> loc_086d; all clear -> tail-jump 0x077f. Two arms + a T-state mutation.
// Run: node --test games/invaders/translated/test/loc_0857.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0857 } from "../loc_0857.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    io: { outs: [], ins: {}, portIn(p) { return this.ins[p] & 0xff || 0; }, portOut(p, v) { this.outs.push([p, v & 0xff]); } },
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
}

test("loc_0857 port1 all clear: DE=0x1aba B=0x98, tail-jump 0x077f; 86 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.io.ins[0x01] = 0x00;

  loc_0857(m);

  assert.equal(m.regs.de, 0x1aba, "lxi d,0x1aba");
  assert.equal(m.regs.b, 0x98, "mvi b,0x98");
  assert.equal(m.regs.a, 0x00, "in 0x01 -> 0, three rrc keep 0");
  assert.equal(m.tstates, 10 + 17 + 7 + 10 + 4 + 4 + 10 + 4 + 10 + 10, "fall-through T total");
  assert.deepEqual(m.calls, [0x08f3, 0x077f], "call 08f3 then tail-jump 077f");
  assert.deepEqual(m.pcSeq, [0x085a, 0x08f3, 0x085f, 0x0861, 0x0862, 0x0863, 0x0866, 0x0867, 0x086a, 0x077f], "step boundaries");
});

test("loc_0857 port1 bit1 set: delegates to loc_086d; 62 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.io.ins[0x01] = 0x02;

  loc_0857(m);

  assert.equal(m.regs.a, 0x80, "0x02 ror ror -> 0x80, carry set at the first jc");
  assert.equal(m.tstates, 10 + 17 + 7 + 10 + 4 + 4 + 10, "T to the jc-taken delegate");
  assert.deepEqual(m.calls, [0x08f3, 0x086d], "call 08f3 then delegate 086d");
  assert.deepEqual(m.pcSeq, [0x085a, 0x08f3, 0x085f, 0x0861, 0x0862, 0x0863, 0x086d], "step boundaries");
});

test("loc_0857 MUTATION: in mis-charged 4T (not 10T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.io.ins[0x01] = 0x00;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0861 ? 4 : c);
  loc_0857(m);
  assert.notEqual(m.tstates, 86, "golden T-state total catches the mutant");
});
