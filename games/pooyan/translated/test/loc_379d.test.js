// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_379d (ROM 0x379d, Pooyan) -- initialise a new IY actor slot from
 * the IX template: biased position copies, a table byte selected via rst 0x20 (loc_0020) and
 * optionally negated, an anim frame via loc_0c45, an anim pointer, then tail-jp 0x0ee3.
 *
 * The mock's `call` POPS the return address the call site pushed (models the callee's `ret`). For
 * rst 0x20 (0x0020) it also replicates loc_0020's effect: HL += A (16-bit), A = mem[HL] -- so the
 * later `ld a,(hl)` reads the right table byte. loc_0c45 only clobbers regs the routine reloads.
 * A call site missing its push16 then desyncs the stack and the final baseline assertion fails.
 *
 * Path A (0x8820!=7 -> 0x38a5; 0x8900<8; 0x8907 bit0 clear -> keep byte; (ix+0x0b)==0 -> keep DE):
 * full pcSeq + T=631. Path B (0x8820==7 -> 0x38ad; 0x8900>=8 -> A=7; 0x8907 bit0 set -> neg;
 * (ix+0x0b)!=0 -> DE=0x3952): the opposite branch at every fork, T=646.
 * TEETH: `add a,0x80` (7 T) mis-charged 4 T -> the 631-T golden throws.
 *
 * Run: node --test games/pooyan/translated/test/loc_379d.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_379d } from "../loc_379d.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x379d, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) {
      regs.sp = (regs.sp - 2) & 0xffff;
      mem.write8(regs.sp, v & 0xff);
      mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
    },
    pop16() {
      const lo = mem.read8(regs.sp);
      const hi = mem.read8((regs.sp + 1) & 0xffff);
      regs.sp = (regs.sp + 2) & 0xffff;
      return lo | (hi << 8);
    },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // Pop the pushed return (models the callee's ret). rst 0x20 -> loc_0020: HL += A (16-bit), A=(HL).
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      if (addr === 0x0020) { regs.hl = (regs.hl + regs.a) & 0xffff; regs.a = mem.read8(regs.hl); }
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

function seedPos(m) {
  m.regs.ix = 0x8ae0;
  m.regs.iy = 0x8b00;
  m.regs.c = 0x33;
  m.regs.de = 0x2211;
  m.mem.write8(0x8ae5, 0x10); // (ix+5) -> +0x80 = 0x90
  m.mem.write8(0x8ae3, 0x20); // (ix+3) -> +0x80 = 0xa0
  m.mem.write8(0x8ae4, 0x05); // (ix+4) -> -1   = 0x04
  m.mem.write8(0x8ae6, 0x07); // (ix+6) -> +1   = 0x08
}

const PC_A = [
  0x37a1, 0x37a5, 0x37a8, 0x37a9, 0x37ac, 0x37af, 0x37b2, 0x37b4, 0x37b7, 0x37ba,
  0x37bc, 0x37bf, 0x37c2, 0x37c4, 0x37c7, 0x37ca, 0x37cc, 0x37cf,
  0x37d2, 0x37d5, 0x37d7,
  0x37dc,                    // jr nz taken (0x8820 != 7)
  0x37df, 0x37e1,
  0x37e5,                    // jr c taken (0x8900 < 8)
  0x0020,                    // rst 0x20 -> target
  0x37e9, 0x37eb, 0x37ec,
  0x37f0,                    // jr z taken (bit0 clear, keep byte)
  0x37f3, 0x37f6, 0x37f9, 0x37fc, 0x37fe, 0x37ff, 0x3800, 0x3801, 0x3802,
  0x0c45,                    // call 0x0c45 -> target
  0x3808, 0x3809,
  0x380e,                    // jr z taken ((ix+0x0b)==0, keep DE)
  0x3811, 0x3814, 0x3817, 0x381b,
  0x0ee3,                    // tail jp -> target
];

test("loc_379d Path A: table 0x38a5, keep byte, (ix+0x0b)==0 -> tail 0x0ee3", () => {
  const m = makeMachine();
  seatCaller(m);
  seedPos(m);
  m.mem.write8(0x8820, 0x00); // != 7 -> jr nz taken, HL stays 0x38a5
  m.mem.write8(0x8900, 0x00); // < 8  -> jr c taken, A=0 at rst
  m.mem.write8(0x38a5, 0x12); // table[0x38a5 + 0] byte
  m.mem.write8(0x8907, 0x00); // bit0 clear -> keep byte, no neg
  m.mem.write8(0x8ae7, 0x30); // (ix+7)&0xf0 >> 4 = 0x03 (anim frame index)
  m.mem.write8(0x8aeb, 0x00); // (ix+0x0b)==0 -> keep DE

  loc_379d(m);

  assert.equal(m.tstates, 631, "Path A T-state total");
  assert.deepEqual(m.pcSeq, PC_A, "step boundaries match the ROM bytes");
  assert.equal(m.pc, 0x0ee3, "tail jp lands on 0x0ee3");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
  assert.deepEqual(m.calls, [0x0020, 0x0c45, 0x0ee3], "rst 0x20, loc_0c45, tail loc_0ee3");
  // position copies
  assert.equal(m.mem.read8(0x8b00), 0x01, "(iy+0)=1");
  assert.equal(m.mem.read8(0x8b02), 0x04, "(iy+2)=4");
  assert.equal(m.mem.read8(0x8b14), 0x33, "(iy+0x14)=C");
  assert.equal(m.mem.read8(0x8b05), 0x90, "(iy+5)=(ix+5)+0x80");
  assert.equal(m.mem.read8(0x8b03), 0xa0, "(iy+3)=(ix+3)+0x80");
  assert.equal(m.mem.read8(0x8b04), 0x04, "(iy+4)=(ix+4)-1");
  assert.equal(m.mem.read8(0x8b06), 0x08, "(iy+6)=(ix+6)+1");
  // table byte kept (bit0 clear), written to both slots
  assert.equal(m.mem.read8(0x8b0a), 0x12, "(iy+0x0a)=table byte");
  assert.equal(m.mem.read8(0x8aea), 0x12, "(ix+0x0a)=table byte");
  // (ix+0x0b)==0 -> DE kept (0x2211), anim byte 0
  assert.equal(m.mem.read8(0x8b0b), 0x00, "(iy+0x0b)=(ix+0x0b)=0");
  assert.equal(m.mem.read8(0x8b0c), 0x11, "(iy+0x0c)=E (DE preserved)");
  assert.equal(m.mem.read8(0x8b0d), 0x22, "(iy+0x0d)=D (DE preserved)");
  assert.equal(m.mem.read8(0x8b11), 0x28, "(iy+0x11)=0x28");
});

const PC_B = [
  0x37a1, 0x37a5, 0x37a8, 0x37a9, 0x37ac, 0x37af, 0x37b2, 0x37b4, 0x37b7, 0x37ba,
  0x37bc, 0x37bf, 0x37c2, 0x37c4, 0x37c7, 0x37ca, 0x37cc, 0x37cf,
  0x37d2, 0x37d5, 0x37d7,
  0x37d9, 0x37dc,            // jr nz NOT taken (0x8820 == 7) -> HL=0x38ad
  0x37df, 0x37e1,
  0x37e3, 0x37e5,            // jr c NOT taken (0x8900 >= 8) -> A=0x07
  0x0020,                    // rst 0x20 -> target
  0x37e9, 0x37eb, 0x37ec,
  0x37ee, 0x37f0,            // jr z NOT taken (bit0 set) -> neg
  0x37f3, 0x37f6, 0x37f9, 0x37fc, 0x37fe, 0x37ff, 0x3800, 0x3801, 0x3802,
  0x0c45,                    // call 0x0c45 -> target
  0x3808, 0x3809,
  0x380b, 0x380e,            // jr z NOT taken ((ix+0x0b)!=0) -> DE=0x3952
  0x3811, 0x3814, 0x3817, 0x381b,
  0x0ee3,                    // tail jp -> target
];

test("loc_379d Path B: table 0x38ad+7, neg byte, (ix+0x0b)!=0 -> DE=0x3952", () => {
  const m = makeMachine();
  seatCaller(m);
  seedPos(m);
  m.mem.write8(0x8820, 0x07); // == 7 -> jr nz not taken -> HL=0x38ad
  m.mem.write8(0x8900, 0x08); // >= 8 -> jr c not taken -> A=0x07 at rst
  m.mem.write8(0x38b4, 0x0a); // table[0x38ad + 7] byte
  m.mem.write8(0x8907, 0x01); // bit0 set -> neg the byte
  m.mem.write8(0x8ae7, 0x50); // anim frame index 0x05
  m.mem.write8(0x8aeb, 0x03); // (ix+0x0b)!=0 -> DE=0x3952

  loc_379d(m);

  assert.equal(m.tstates, 646, "Path B T-state total");
  assert.deepEqual(m.pcSeq, PC_B, "step boundaries match the ROM bytes");
  assert.equal(m.pc, 0x0ee3, "tail jp lands on 0x0ee3");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
  assert.equal(m.mem.read8(0x8b0a), 0xf6, "(iy+0x0a)=neg(0x0a)=0xf6");
  assert.equal(m.mem.read8(0x8aea), 0xf6, "(ix+0x0a)=0xf6");
  assert.equal(m.mem.read8(0x8b0b), 0x03, "(iy+0x0b)=(ix+0x0b)=3");
  assert.equal(m.mem.read8(0x8b0c), 0x52, "(iy+0x0c)=E (DE=0x3952)");
  assert.equal(m.mem.read8(0x8b0d), 0x39, "(iy+0x0d)=D (DE=0x3952)");
});

test("loc_379d MUTATION: `add a,0x80` mis-charged 4 T (not 7 T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  // 0x37b4 is the step-target charged for `add a,0x80` at 0x37b2
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x37b4 ? 4 : cycles);
  seatCaller(m);
  seedPos(m);
  m.mem.write8(0x8820, 0x00);
  m.mem.write8(0x8900, 0x00);
  m.mem.write8(0x38a5, 0x12);
  m.mem.write8(0x8907, 0x00);
  m.mem.write8(0x8ae7, 0x30);
  m.mem.write8(0x8aeb, 0x00);

  loc_379d(m);

  assert.equal(m.tstates, 628, "mutation loses 3 T (7 -> 4)");
  assert.throws(() => assert.equal(m.tstates, 631, "Path A T-state total"), /631/);
});
