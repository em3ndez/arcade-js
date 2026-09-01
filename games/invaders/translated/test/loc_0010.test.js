// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_0010 (ROM 0x0010-0x0071): the RST2 (vblank) vector. Two data-seated
// arms -- (A) input bit0 set -> pause latch at 0x20ea, then play-flag clear -> bail to loc_0082;
// (B) input bit0 clear -> BCD tick at 0x20eb (adi/daa), then dispatch reaches loc_006f which calls
// 0x1740 and falls through into loc_0072. Pins the busy flag, the 0x20c0 dcr, the latches, the
// call return addresses, delegates, and the exact T-states.
//
// Run: node --test games/invaders/translated/test/loc_0010.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0010 } from "../loc_0010.js";

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

test("loc_0010 arm A: input bit0 set -> pause latch + bail to loc_0082; 195 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write8(0x20c0, 0x05); // dcr m -> 0x04
  m.mem.write8(0x20e9, 0x00); // play flag clear -> jz 0x0082 taken
  m.ports[0x01] = 0x01;       // input bit0 set -> rrc sets carry -> loc_0067

  loc_0010(m);

  assert.equal(m.mem.read8(0x2072), 0x80, "busy flag mvi a,0x80; sta 0x2072");
  assert.equal(m.mem.read8(0x20c0), 0x04, "dcr m ticks the 0x20c0 counter");
  assert.equal(m.mem.read8(0x20ea), 0x01, "pause latch: loc_0067 then loc_003f store 0x01");
  assert.equal(m.regs.a, 0x00, "A=0 after final ana a on (0x20e9)=0");
  assert.equal(m.regs.hl, 0x20c0, "HL left at the counter address");
  assert.equal(m.regs.sp, 0x23f6, "SP: four reg pushes + call 0x17cd");
  assert.equal(m.pc, 0x0082, "bail lands at the epilogue");
  assert.equal(m.tstates, 195, "golden T total for arm A");
  assert.deepEqual(m.calls, [0x17cd, 0x0082], "sound tick then delegate to loc_0082");
  assert.equal(m.mem.read16(0x23f6), 0x0020, "call 0x17cd return addr");
});

test("loc_0010 arm B: input bit0 clear -> BCD tick, loc_006f calls 0x1740, falls into loc_0072; 311 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write8(0x20c0, 0x08); // dcr m -> 0x07
  m.mem.write8(0x20ea, 0x01); // nonzero -> jz 0x0042 NOT taken
  m.mem.write8(0x20eb, 0x50); // != 0x99 -> jz 0x003e NOT taken -> adi/daa
  m.mem.write8(0x20e9, 0x01); // play flag set -> jz 0x0082 NOT taken
  m.mem.write8(0x20ef, 0x01); // nonzero -> jnz 0x006f taken
  m.ports[0x01] = 0x00;       // input bit0 clear -> rrc clears carry

  loc_0010(m);

  assert.equal(m.mem.read8(0x2072), 0x80, "busy flag set");
  assert.equal(m.mem.read8(0x20c0), 0x07, "dcr m ticks the counter");
  assert.equal(m.mem.read8(0x20eb), 0x51, "adi 0x01 + daa: 0x50 -> 0x51");
  assert.equal(m.mem.read8(0x20ea), 0x00, "loc_003f stores A=0 (from xra a)");
  assert.equal(m.regs.a, 0x01, "A holds (0x20ef) at the loc_006f branch");
  assert.equal(m.regs.sp, 0x23f2, "SP: 4 reg pushes + calls 0x17cd/0x1947/0x1740");
  assert.equal(m.pc, 0x1740, "last step is call 0x1740's target");
  assert.equal(m.tstates, 311, "golden T total for arm B");
  assert.deepEqual(m.calls, [0x17cd, 0x1947, 0x1740, 0x0072], "sound+score ticks, then fall into loc_0072");
  assert.equal(m.mem.read16(0x23f2), 0x0072, "call 0x1740 return addr (also loc_0072 entry)");
  assert.equal(m.mem.read16(0x23f4), 0x003e, "call 0x1947 return addr");
  assert.equal(m.mem.read16(0x23f6), 0x0020, "call 0x17cd return addr");
});

test("loc_0010 MUTATION: `call 0x17cd` mis-charged 11T not 17T is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write8(0x20e9, 0x00);
  m.ports[0x01] = 0x01;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x17cd ? 11 : c);
  loc_0010(m);
  assert.notEqual(m.tstates, 195, "golden T-state total catches the mutant");
});
