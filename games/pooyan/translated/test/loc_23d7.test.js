// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_23d7 (ROM 0x23d7-0x23eb): derive the 3-Y sprite trio. Flat-RAM mock,
// real Regs. Run: node --test games/pooyan/translated/test/loc_23d7.test.js

import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_23d7 } from "../loc_23d7.js";

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
    call(a) { this.calls.push(a); return undefined; },
  };
}
function seat(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_23d7: Y=0x50 -> (0x8acc)=0x50,(0x8ab4)=0x40,(0x8a9c)=0x4a; 114 T", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(0x8a84, 0x50); // (ix+4)

  loc_23d7(m);

  assert.equal(m.tstates, 114, "T total");
  assert.equal(m.pc, CALLER_RET, "ret");
  assert.equal(m.regs.ix, 0x8a80, "ix seated");
  assert.equal(m.mem.read8(0x8acc), 0x50, "(ix+0x4c)=Y");
  assert.equal(m.mem.read8(0x8ab4), 0x40, "(ix+0x34)=Y-0x10");
  assert.equal(m.mem.read8(0x8a9c), 0x4a, "(ix+0x1c)=Y-0x10+0x0a");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
});

test("loc_23d7 MUTATION: ld a,(ix+4) mis-charged 13T (not 19T) is caught", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(0x8a84, 0x50);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x23de ? 13 : c);
  loc_23d7(m);
  assert.notEqual(m.tstates, 114, "golden T catches the mutant");
});
