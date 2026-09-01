// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_14cb (ROM 0x14cb): zero A (xra a, clears carry) then fall through into
// loc_14cc (recorded as a delegate). The column-fill loop itself lives in loc_14cc.
//
// Run: node --test games/invaders/translated/test/loc_14cb.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_14cb } from "../loc_14cb.js";

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
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

test("loc_14cb: zeroes A and delegates into loc_14cc; 4 T", () => {
  const m = makeMachine();
  m.regs.a = 0xff;
  m.regs.f = 0x01; // carry set beforehand

  loc_14cb(m);

  assert.equal(m.regs.a, 0x00, "A := 0 (xra a)");
  assert.equal(m.regs.fC, false, "xra a clears carry");
  assert.equal(m.tstates, 4, "single xra a");
  assert.deepEqual(m.calls, [0x14cc], "falls through into loc_14cc");
  assert.equal(m.pc, 0x14cc, "last step lands at the loc_14cc entry");
});

test("loc_14cb MUTATION: `xra a` mis-charged 7T (not 4T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x14cc ? 7 : c);
  loc_14cb(m);
  assert.notEqual(m.tstates, 4, "golden T-state total catches the mutant");
});
