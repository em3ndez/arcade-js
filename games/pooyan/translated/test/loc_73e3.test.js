// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_73e3 (ROM 0x73e3-0x7402): eagle idle/between-waves handler. Pins the
// (0x8f36)-hold tick path.
//
// Run: node --test games/pooyan/translated/test/loc_73e3.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_73e3 } from "../loc_73e3.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(c = 10) { this.step(this.pop16(), c); },
    call(addr) { this.calls.push(addr); this.ret(); return undefined; },
  };
}
function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_73e3 hold: (0x8f36)!=0 -> dec, ret; 49 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f36, 0x05);

  loc_73e3(m);

  assert.equal(m.tstates, 10 + 7 + 4 + 7 + 11 + 10, "49 T");
  assert.equal(m.pc, CALLER_RET, "returns to caller");
  assert.equal(m.mem.read8(0x8f36), 0x04, "hold ticked");
  assert.deepEqual(m.calls, [], "no enqueue on the hold path");
  assert.deepEqual(m.pcSeq, [0x73e6, 0x73e7, 0x73e8, 0x73ea, 0x73eb, CALLER_RET], "boundaries");
});

test("loc_73e3 expiry, no wave: reseed hold 0x18, clear (0x8f3a); 113 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f36, 0x00); // expired
  m.mem.write8(0x8f3d, 0x00); // no wave -> skip rst 0x38
  m.mem.write8(0x8f3a, 0x99);

  loc_73e3(m);

  assert.equal(m.tstates, 10 + 7 + 4 + 12 + 13 + 4 + 12 + 7 + 13 + 4 + 10 + 7 + 10, "113 T");
  assert.equal(m.mem.read8(0x8f36), 0x18, "hold reseeded");
  assert.equal(m.mem.read8(0x8f3a), 0x00, "launch flag cleared");
  assert.deepEqual(m.calls, [], "(0x8f3d)==0 -> no sound enqueue");
  assert.deepEqual(m.pcSeq, [0x73e6, 0x73e7, 0x73e8, 0x73ec, 0x73ef, 0x73f0, 0x73f8, 0x73fa, 0x73fd, 0x73fe, 0x7401, 0x7402, CALLER_RET], "boundaries");
});

test("loc_73e3 MUTATION: dec (hl) at 0x73ea mischarged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f36, 0x05);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x73eb ? 7 : c);
  loc_73e3(m);
  assert.notEqual(m.tstates, 49, "golden 49 T catches the mischarge");
});
