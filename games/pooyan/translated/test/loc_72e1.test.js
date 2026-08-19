// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_72e1 (ROM 0x72e1-0x733b): the eagle-wave seeder. Pins the early-return
// guard and the 4th-wave branch (which skips the record-init loop).
//
// Run: node --test games/pooyan/translated/test/loc_72e1.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_72e1 } from "../loc_72e1.js";

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
    call(addr) { this.calls.push(addr); return undefined; },
  };
}
function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_72e1 guard: (0x8c90)!=0 -> ret nz; 28 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8c90, 0x01);

  loc_72e1(m);

  assert.equal(m.tstates, 13 + 4 + 11, "28 T");
  assert.equal(m.pc, CALLER_RET, "ret nz returns to caller");
  assert.deepEqual(m.pcSeq, [0x72e4, 0x72e5, CALLER_RET], "boundaries");
});

test("loc_72e1 4th wave: (0x8f3d) reaches 4 -> re-arm phase, hold=0x20, ret (no record loop); 126 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8c90, 0x00);
  m.mem.write8(0x8f3d, 0x03); // inc -> 4
  m.mem.write8(0x8f38, 0x00);

  loc_72e1(m);

  assert.equal(m.tstates, 13 + 4 + 5 + 4 + 13 + 10 + 11 + 7 + 7 + 7 + 7 + 11 + 7 + 10 + 10, "126 T");
  assert.equal(m.pc, CALLER_RET, "returns to caller");
  assert.equal(m.mem.read8(0x8f3a), 0x01, "launch flag set");
  assert.equal(m.mem.read8(0x8f3d), 0x04, "wave index bumped to 4");
  assert.equal(m.mem.read8(0x8f38), 0x01, "outer phase advanced");
  assert.equal(m.mem.read8(0x8f36), 0x20, "inter-wave hold seeded");
  assert.deepEqual(m.pcSeq,
    [0x72e4, 0x72e5, 0x72e6, 0x72e7, 0x72ea, 0x72ed, 0x72ee, 0x72ef, 0x72f1, 0x72f3, 0x72f5, 0x72f6, 0x72f8, 0x72fa, CALLER_RET],
    "boundaries");
});

test("loc_72e1 MUTATION: inc (hl) at 0x72ed mischarged 6T (not 11T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8c90, 0x00);
  m.mem.write8(0x8f3d, 0x03);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x72ee ? 6 : c);
  loc_72e1(m);
  assert.notEqual(m.tstates, 126, "golden 126 T catches the mischarge");
});
