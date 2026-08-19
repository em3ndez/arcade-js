// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_6f42 (ROM 0x6f42-0x6f5d): level-intro phase 2 (draw counter). Pins the
// (0x8f52)==0 path (0x1131 skipped). loc_1119/loc_1131 are plain-ret callees.
//
// Run: node --test games/pooyan/translated/test/loc_6f42.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6f42 } from "../loc_6f42.js";

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

test("loc_6f42 (0x8f52)==0: advance phase, two 0x1119 draws (0x1131 skipped); 158 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f51, 0x00);
  m.mem.write8(0x8f52, 0x00);

  loc_6f42(m);

  assert.equal(m.tstates, 10 + 11 + 6 + 7 + 4 + 12 + 10 + 17 + 10 + 11 + 11 + 4 + 4 + 4 + 17 + 10 + 10, "158 T");
  assert.equal(m.pc, CALLER_RET, "returns to caller");
  assert.equal(m.mem.read8(0x8f51), 0x01, "phase advanced");
  assert.deepEqual(m.calls, [0x1119, 0x1119], "two address/draw calls, 0x1131 skipped");
  assert.deepEqual(m.pcSeq,
    [0x6f45, 0x6f46, 0x6f47, 0x6f48, 0x6f49, 0x6f4f, 0x6f52, 0x1119, 0x6f55, 0x6f56, 0x6f57,
     0x6f58, 0x6f59, 0x6f5a, 0x1119, 0x6f5d, CALLER_RET], "boundaries");
});

test("loc_6f42 MUTATION: daa at 0x6f59 mischarged 8T (not 4T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x6f5a ? 8 : c);
  loc_6f42(m);
  assert.notEqual(m.tstates, 158, "golden 158 T catches the mischarge");
});
