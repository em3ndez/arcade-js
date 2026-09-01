// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_1956 (ROM 0x1956-0x196a): init/redraw batch of six calls, then tail-
// delegate to loc_1947. Pins the call sequence, the six return addresses, T total.
//
// Run: node --test games/invaders/translated/test/loc_1956.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1956 } from "../loc_1956.js";

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
    call(addr) { this.calls.push(addr); return undefined; }, // record-only: does not pop
  };
}

test("loc_1956: six calls then delegate to loc_1947; 112 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;

  loc_1956(m);

  assert.equal(m.tstates, 17 * 6 + 10, "T: six calls (17) + jmp (10)");
  assert.equal(m.pc, 0x1947, "last step lands at the delegate");
  assert.deepEqual(m.calls, [0x1a5c, 0x191a, 0x1925, 0x192b, 0x1950, 0x193c, 0x1947], "call chain then delegate");
  // record-only call never pops, so six pushes leave SP 12 lower with each return addr live
  assert.equal(m.mem.read16(0x23fe), 0x1959, "call 0x1a5c pushes 0x1959");
  assert.equal(m.mem.read16(0x23fc), 0x195c, "call 0x191a pushes 0x195c");
  assert.equal(m.mem.read16(0x23f4), 0x1968, "call 0x193c pushes 0x1968");
  assert.deepEqual(m.pcSeq, [0x1a5c, 0x191a, 0x1925, 0x192b, 0x1950, 0x193c, 0x1947], "step boundaries");
});

test("loc_1956 MUTATION: a dropped call (only five) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  loc_1956(m);
  assert.notEqual(m.calls.length, 6, "the golden 7-entry call chain catches a dropped call");
});
