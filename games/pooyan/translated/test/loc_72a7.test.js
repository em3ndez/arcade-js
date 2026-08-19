// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_72a7 (ROM 0x72a7-0x72ce): eagle-launch driver. Pins the pre-launch path
// ((0x8f3a)==0 -> seed via 0x72e1, ret).
//
// Run: node --test games/pooyan/translated/test/loc_72a7.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_72a7 } from "../loc_72a7.js";

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

test("loc_72a7 pre-launch: (0x8f3a)==0 -> seed via 0x72e1, ret; 65 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f3a, 0x00);

  loc_72a7(m);

  assert.equal(m.tstates, 10 + 7 + 4 + 7 + 17 + 10 + 10, "65 T");
  assert.equal(m.pc, CALLER_RET, "returns to caller");
  assert.deepEqual(m.calls, [0x72e1], "seeds the wave");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.deepEqual(m.pcSeq, [0x72aa, 0x72ab, 0x72ac, 0x72ae, 0x72e1, 0x72b1, CALLER_RET], "boundaries");
});

test("loc_72a7 MUTATION: ld a,(hl) at 0x72aa mischarged 4T (not 7T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x72ab ? 4 : c);
  loc_72a7(m);
  assert.notEqual(m.tstates, 65, "golden 65 T catches the mischarge");
});
