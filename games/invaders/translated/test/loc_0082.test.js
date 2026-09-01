// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_0082 (ROM 0x0082-0x0087): the shared interrupt epilogue -- pops
// HL/DE/BC/PSW, ei, ret. Seats a five-word stack and pins the register restores (incl. the PSW
// mask), the final SP, the returned PC, and the exact T-states.
//
// Run: node --test games/invaders/translated/test/loc_0082.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0082 } from "../loc_0082.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; },
  };
  const m = {
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [], ports: {},
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
  m.io = { portIn: (p) => m.ports[p] ?? 0, portOut: (p, v) => { m.ports[p] = v & 0xff; } };
  return m;
}

test("loc_0082: pops HL/DE/BC/PSW, ei, ret; 54 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x23f6;
  m.mem.write16(0x23f6, 0xbcde); // -> hl
  m.mem.write16(0x23f8, 0x789a); // -> de
  m.mem.write16(0x23fa, 0x3456); // -> bc
  m.mem.write16(0x23fc, 0xabcd); // -> psw (af setter masks f to 0xc7)
  m.mem.write16(0x23fe, 0x1234); // -> ret address

  loc_0082(m);

  assert.equal(m.regs.hl, 0xbcde, "pop h");
  assert.equal(m.regs.de, 0x789a, "pop d");
  assert.equal(m.regs.bc, 0x3456, "pop b");
  assert.equal(m.regs.a, 0xab, "pop psw -> A");
  assert.equal(m.regs.f, 0xc7, "pop psw -> F masked (0xcd & 0xd5 | 0x02)");
  assert.equal(m.regs.sp, 0x2400, "SP: 0x23f6 + five 2-byte pops");
  assert.equal(m.pc, 0x1234, "ret lands at the popped address");
  assert.equal(m.tstates, 10 + 10 + 10 + 10 + 4 + 10, "T total: 4x pop(10)+ei(4)+ret(10)");
  assert.deepEqual(m.calls, [], "ret is not a call");
});

test("loc_0082 MUTATION: `ret` mis-charged 4T not 10T is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x23f6;
  m.mem.write16(0x23fe, 0x1234);
  const realRet = m.ret.bind(m);
  m.ret = () => realRet(4);
  loc_0082(m);
  assert.notEqual(m.tstates, 54, "golden T-state total catches the mutant");
});
