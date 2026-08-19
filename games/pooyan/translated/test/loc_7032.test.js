// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_7032 (ROM 0x7032-0x7058): level-intro phase 5. Pins the delay-expiry path
// ((0x8f47)==0 skips 0x7059; (0x8f48)==0 -> advance to phase 6).
//
// Run: node --test games/pooyan/translated/test/loc_7032.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_7032 } from "../loc_7032.js";

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

test("loc_7032 expiry: (0x8f48)==0 -> reload 0x20 and advance to phase 6; 98 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f47, 0x00); // skip 0x7059
  m.mem.write8(0x8f48, 0x00); // delay elapsed
  m.mem.write8(0x8f51, 0x00);

  loc_7032(m);

  assert.equal(m.tstates, 10 + 7 + 4 + 10 + 6 + 7 + 4 + 12 + 10 + 7 + 11 + 10, "98 T");
  assert.equal(m.pc, CALLER_RET, "returns to caller");
  assert.equal(m.mem.read8(0x8f48), 0x20, "(0x8f48) reloaded");
  assert.equal(m.mem.read8(0x8f51), 0x01, "phase advanced to 6");
  assert.deepEqual(m.calls, [], "(0x8f47)==0 -> 0x7059 skipped");
  assert.deepEqual(m.pcSeq,
    [0x7035, 0x7036, 0x7037, 0x703a, 0x703b, 0x703c, 0x703d, 0x7053, 0x7055, 0x7057, 0x7058, CALLER_RET],
    "boundaries");
});

test("loc_7032 MUTATION: inc (hl) at 0x7057 mischarged 6T (not 11T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f47, 0x00);
  m.mem.write8(0x8f48, 0x00);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x7058 ? 6 : c);
  loc_7032(m);
  assert.notEqual(m.tstates, 98, "golden 98 T catches the mischarge");
});
