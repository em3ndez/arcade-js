// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_15c5 (ROM 0x15c5-0x15d1): scan 23 bytes from HL for the first nonzero.
// Pins the all-zero fall-through-to-ret path, the found-nonzero tail-branch to 0x166b, register
// writes, exact MAME i8080 T-states, and the m.calls delegation.
//
// Run: node --test games/invaders/translated/test/loc_15c5.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_15c5 } from "../loc_15c5.js";

const CALLER_RET = 0xface;

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
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
}

test("loc_15c5: all-zero region walks 23 bytes and rets; HL advances by 23; 960 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.regs.hl = 0x3000; // ram is all-zero

  loc_15c5(m);

  assert.equal(m.regs.b, 0x00, "B counted down 0x17 -> 0");
  assert.equal(m.regs.hl, 0x3017, "HL advanced by 0x17 (23) bytes");
  assert.equal(m.regs.a, 0x00, "A holds the last (zero) byte read");
  assert.deepEqual(m.calls, [], "no nonzero -> no branch to 0x166b");
  assert.equal(m.pc, CALLER_RET, "ret pops the caller return");
  // mvi b(7) + 23 * (mov 7 + ana 4 + jnz166b 10 + inx 5 + dcr 5 + jnz15c7 10 = 41) + ret(10)
  assert.equal(m.tstates, 7 + 23 * 41 + 10, "960 T");
  assert.equal(m.tstates, 960, "explicit golden total");
});

test("loc_15c5: first byte nonzero -> tail-branch to 0x166b on iter 1; 28 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.regs.hl = 0x3000;
  m.mem.write8(0x3000, 0x05);

  loc_15c5(m);

  assert.deepEqual(m.calls, [0x166b], "found nonzero -> delegate to 0x166b (stc)");
  assert.equal(m.pc, 0x166b, "last step lands at the 0x166b entry");
  assert.equal(m.regs.a, 0x05, "A holds the nonzero byte");
  assert.equal(m.regs.b, 0x17, "B untouched (branch before dcr b)");
  assert.equal(m.regs.hl, 0x3000, "HL untouched (branch before inx h)");
  assert.equal(m.tstates, 28, "mvi b(7) + mov(7) + ana(4) + jnz taken(10) = 28 T");
});

test("loc_15c5 MUTATION: `ana a` mis-charged 7T (not 4T) is caught (all-zero path)", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.regs.hl = 0x3000;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x15c9 ? 7 : c); // 0x15c9 is the addr after ana a
  loc_15c5(m);
  assert.equal(m.tstates, 960 + 23 * 3, "mutation adds 3 T on each of 23 ana a");
  assert.notEqual(m.tstates, 960, "golden T-state total catches the mutant");
});
