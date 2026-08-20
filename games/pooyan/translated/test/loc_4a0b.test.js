// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_4a0b (ROM 0x4a0b-0x4a4f, Pooyan): gated on 0x8907 bit0 (ret z if clear).
// Snapshots the count at 0x8902 into 0x8d43/0x8934. Count 0 -> seed HL=0x8682/DE=0x2754 and call loc_3307.
// Count N>0 -> seed pointer 0x86a3, paint N rows of the 4-tile marker at 0x86c3 (row stride 0xffdf), back
// the pointer up by 0xffbf, DE=0x2754, and call loc_3307.
//
// The mock's `call` POPS the return address the call site pushed (models loc_3307's `ret`); a missing
// push16 at the call site then desyncs the following ret -- the stack tooth catches it.
// Run: node --test games/pooyan/translated/test/loc_4a0b.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_4a0b } from "../loc_4a0b.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x4a0b, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // POPS the return address a call site pushed (models loc_3307's `ret`); a missing push16 desyncs.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_4a0b COUNT0: 0x8902==0 -> seed HL=0x8682, call loc_3307; 146 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x01); // bit0 set -> gate open
  m.mem.write8(0x8902, 0x00); // count 0 -> jr nz not taken

  loc_4a0b(m);

  assert.equal(m.tstates, 146, "COUNT0 T-state total");
  assert.deepEqual(m.pcSeq, [
    0x4a0e, 0x4a10, 0x4a11, 0x4a14, 0x4a17, 0x4a1a, 0x4a1b, 0x4a1d,
    0x4a20, 0x4a23, 0x4a25, 0x4a28, 0x3307, CALLER_RET,
  ], "step boundaries match the ROM bytes");
  assert.equal(m.pc, CALLER_RET, "ret to the seated caller");
  assert.deepEqual(m.calls, [0x3307], "loc_3307 invoked once");
  assert.equal(m.mem.read8(0x8d43), 0x00, "count snapshot -> 0x8d43");
  assert.equal(m.mem.read8(0x8934), 0x00, "count snapshot -> 0x8934");
  assert.equal(m.mem.read8(0x8932), 0xe3, "0x8932 lo (ld (0x8932),hl = 0x86e3)");
  assert.equal(m.mem.read8(0x8933), 0x86, "0x8933 hi");
  assert.equal(m.regs.hl, 0x8682, "HL = 0x8682 (H kept, ld l,0x82)");
  assert.equal(m.regs.de, 0x2754, "DE = layout pointer");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound (call push16 matched, then ret pops CALLER_RET)");
});

test("loc_4a0b COUNT2: 0x8902==2 -> paint 2 marker rows, call loc_3307; 352 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x01);
  m.mem.write8(0x8902, 0x02); // count 2 -> jr nz taken

  loc_4a0b(m);

  assert.equal(m.tstates, 352, "COUNT2 T-state total");
  assert.deepEqual(m.pcSeq, [
    0x4a0e, 0x4a10, 0x4a11, 0x4a14, 0x4a17, 0x4a1a, 0x4a1b, 0x4a2c, 0x4a2d, 0x4a30, 0x4a33, 0x4a35, 0x4a38,
    0x4a3a, 0x4a3b, 0x4a3d, 0x4a3e, 0x4a40, 0x4a41, 0x4a43, 0x4a44, 0x4a38, // row 1
    0x4a3a, 0x4a3b, 0x4a3d, 0x4a3e, 0x4a40, 0x4a41, 0x4a43, 0x4a44, 0x4a46, // row 2 -> loop out
    0x4a48, 0x4a49, 0x4a4c, 0x3307,
    CALLER_RET,
  ], "step boundaries match the ROM bytes");
  assert.deepEqual(m.calls, [0x3307], "loc_3307 invoked once");
  assert.equal(m.mem.read8(0x8d43), 0x02, "count snapshot -> 0x8d43");
  assert.equal(m.mem.read8(0x8934), 0x02, "count snapshot -> 0x8934");
  assert.equal(m.mem.read8(0x8932), 0xa3, "0x8932 lo (0x86a3)");
  assert.equal(m.mem.read8(0x8933), 0x86, "0x8933 hi");
  // row 1 at HL=0x86c3: 0xda,0xdb then addHl 0xffdf -> 0x86a3: 0xd8,0xd9
  assert.equal(m.mem.read8(0x86c3), 0xda, "row1 tile da");
  assert.equal(m.mem.read8(0x86c4), 0xdb, "row1 tile db");
  assert.equal(m.mem.read8(0x86a3), 0xd8, "row1 tile d8");
  assert.equal(m.mem.read8(0x86a4), 0xd9, "row1 tile d9");
  // row 2 at HL=0x8683: 0xda,0xdb then -> 0x8663: 0xd8,0xd9
  assert.equal(m.mem.read8(0x8683), 0xda, "row2 tile da");
  assert.equal(m.mem.read8(0x8684), 0xdb, "row2 tile db");
  assert.equal(m.mem.read8(0x8663), 0xd8, "row2 tile d8");
  assert.equal(m.mem.read8(0x8664), 0xd9, "row2 tile d9");
  assert.equal(m.regs.hl, 0x8602, "HL after ld e,0xbf + add hl,de (0x8643 + 0xffbf)");
  assert.equal(m.regs.de, 0x2754, "DE = layout pointer");
  assert.equal(m.regs.b, 0x00, "djnz drained B");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound");
});

test("loc_4a0b GATE: 0x8907 bit0 clear -> ret z immediately; 32 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x00); // bit0 clear

  loc_4a0b(m);

  assert.equal(m.tstates, 32, "GATE T-state total (13+8+11)");
  assert.deepEqual(m.pcSeq, [0x4a0e, 0x4a10, CALLER_RET]);
  assert.deepEqual(m.calls, [], "no work done");
  assert.equal(m.mem.read8(0x8d43), 0x00, "no snapshot written");
});

test("loc_4a0b MUTATION: `call 0x3307` mis-charged 10T (not 17T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x3307 ? 10 : cycles);
  seatCaller(m);
  m.mem.write8(0x8907, 0x01);
  m.mem.write8(0x8902, 0x00);

  loc_4a0b(m);

  assert.equal(m.tstates, 139, "mutation loses 7 T (17 -> 10)");
  assert.throws(
    () => assert.equal(m.tstates, 146, "COUNT0 T-state total"),
    /146/,
    "the 146-T golden must fail on the mutant",
  );
});
