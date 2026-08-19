// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_6db8 (ROM 0x6db8-0x6df8): level-intro phase 0. Pins the (0x8907)=0 path:
// the timer word is looked up, the phase counter is advanced, and (0x8907)>>3 has no carry so the
// ANTI-TAMPER compare is skipped (ret nc). loc_0fbc / loc_0c45 are plain-ret callees (pattern-A).
//
// Run: node --test games/pooyan/translated/test/loc_6db8.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6db8 } from "../loc_6db8.js";

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

test("loc_6db8 (0x8907)=0: lookup + advance phase, ret nc (no compare); 228 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x00);
  m.mem.write8(0x8f51, 0x00);

  loc_6db8(m);

  assert.equal(m.tstates,
    17 + 10 + 13 + 8 + 8 + 7 + 12 + 7 + 10 + 17 + 10 + 20 + 7 + 13 + 10 + 11 + 13 + 8 + 8 + 8 + 11, "228 T");
  assert.equal(m.pc, CALLER_RET, "ret nc returns to caller");
  assert.equal(m.mem.read8(0x8f48), 0x40, "(0x8f48) delay primed");
  assert.equal(m.mem.read8(0x8f51), 0x01, "phase counter advanced");
  assert.deepEqual(m.calls, [0x0fbc, 0x0c45], "frame update + table lookup, NO tamper path");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.deepEqual(m.pcSeq,
    [0x0fbc, 0x6dbb, 0x6dbe, 0x6dc0, 0x6dc2, 0x6dc4, 0x6dc8, 0x6dca, 0x6dcd, 0x0c45, 0x6dd0,
     0x6dd4, 0x6dd6, 0x6dd9, 0x6ddc, 0x6ddd, 0x6de0, 0x6de2, 0x6de4, 0x6de6, CALLER_RET], "boundaries");
});

test("loc_6db8 MUTATION: srl a at 0x6dbe mischarged 4T (not 8T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x00);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x6dc0 ? 4 : c);
  loc_6db8(m);
  assert.notEqual(m.tstates, 228, "golden 228 T catches the mischarge");
});
