// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_008c (ROM 0x008c-0x00b0): RST1 body. Two arms are exercised --
// the draw path (0x20ef set -> loc_00a5 draw pair) and the early bail (0x20e9 clear -> jz 0x0082).
// Pins the 0x2072 clear, the branch dispatch, the call return addresses, delegates, and T-states.
//
// Run: node --test games/invaders/translated/test/loc_008c.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_008c } from "../loc_008c.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; },
  };
  const m = {
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [], ports: {},
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
  m.io = { portIn: (p) => m.ports[p] ?? 0, portOut: (p, v) => { m.ports[p] = v & 0xff; } };
  return m;
}

test("loc_008c DRAW arm: 0x20ef set -> loc_00a5 draw pair, delegates to loc_0082; 125 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write8(0x20e9, 0x01); // play flag set -> jz 0x0082 NOT taken
  m.mem.write8(0x20ef, 0x01); // -> jnz 0x00a5 taken

  loc_008c(m);

  assert.equal(m.mem.read8(0x2072), 0x00, "xra a then sta 0x2072 clears busy flag");
  assert.equal(m.regs.a, 0x01, "A holds (0x20ef) at the branch");
  assert.equal(m.regs.hl, 0x2020, "loc_00a5 seats HL=0x2020");
  assert.equal(m.regs.sp, 0x23fc, "SP: 0x2400 - two call pushes");
  assert.equal(m.pc, 0x0082, "jmp 0x0082 lands at the epilogue");
  assert.equal(m.tstates, 4 + 13 + 13 + 4 + 10 + 13 + 4 + 10 + 10 + 17 + 17 + 10, "T total draw arm");
  assert.deepEqual(m.calls, [0x024b, 0x0141, 0x0082], "draw pair then delegate to loc_0082");
  assert.equal(m.mem.read16(0x23fe), 0x00ab, "call 0x024b return addr");
  assert.equal(m.mem.read16(0x23fc), 0x00ae, "call 0x0141 return addr");
});

test("loc_008c BAIL arm: 0x20e9 clear -> jz 0x0082 delegate; 44 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write8(0x20e9, 0x00); // play flag clear -> jz 0x0082 taken

  loc_008c(m);

  assert.equal(m.mem.read8(0x2072), 0x00, "busy flag cleared before bail");
  assert.equal(m.pc, 0x0082, "jz 0x0082 taken");
  assert.equal(m.tstates, 4 + 13 + 13 + 4 + 10, "T total: xra+sta+lda+ana+jz");
  assert.deepEqual(m.calls, [0x0082], "delegates straight to loc_0082");
});

test("loc_008c MUTATION: `call 0x024b` mis-charged 11T not 17T is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write8(0x20e9, 0x01);
  m.mem.write8(0x20ef, 0x01);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x024b ? 11 : c);
  loc_008c(m);
  assert.notEqual(m.tstates, 125, "golden T-state total catches the mutant");
});
