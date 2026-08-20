// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_613d (ROM 0x613d, Pooyan) -- matched-record handler. If (iy+0)
 * bit0 is clear it tail-jumps loc_618a; else it bails to boundary 0x6166 when 0x8907 bit0 is set
 * or when 0x8d44 != 3; otherwise it seats A=(iy+0x14)/IX=0x8b70/DE=0x18/B=6 and falls into loc_615d.
 *
 * No real CALL here -- every exit is a tail-jump (m.call with no push16). The mock's `call` POPS the
 * seated CALLER_RET, modelling the tail chain returning to loc_613d's caller, so SP unwinds to the
 * pre-seat baseline 0x8780 on every path.
 *
 * Paths: Z (bit0 clear -> 0x618a, T=32); NZ1 (0x8907 bit0 set -> 0x6166, T=59); NZ2 (0x8d44 != 3 ->
 * 0x6166, T=86); FALL (0x8d44 == 3, fall into 0x615d, T=131). TOOTH: mis-charge `ld a,(iy+0x14)`
 * (19 T) as 7 T on FALL -> the 131-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_613d.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_613d } from "../loc_613d.js";

const CALLER_RET = 0xabcd;
const IY = 0x8ae0;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x613d, pcSeq: [],
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
    // Tail-jump chain rets to loc_613d's caller -- model that single net pop of the seated CALLER_RET.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
  m.regs.iy = IY;
}

test("loc_613d Path Z: (iy+0) bit0 clear -> tail-jump loc_618a", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IY + 0x00, 0x00); // bit0 clear -> jr z taken

  loc_613d(m);

  assert.equal(m.tstates, 32, "Path Z T-state total");
  assert.deepEqual(m.pcSeq, [0x6141, 0x618a]);
  assert.equal(m.pc, 0x618a);
  assert.deepEqual(m.calls, [0x618a]);
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_613d Path NZ1: 0x8907 bit0 set -> tail-jump boundary 0x6166", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IY + 0x00, 0x01); // bit0 set -> jr z not taken
  m.mem.write8(0x8907, 0x01);    // and 0x01 -> NZ -> jr nz taken

  loc_613d(m);

  assert.equal(m.tstates, 59, "Path NZ1 T-state total");
  assert.deepEqual(m.pcSeq, [0x6141, 0x6143, 0x6146, 0x6148, 0x6166]);
  assert.equal(m.pc, 0x6166);
  assert.deepEqual(m.calls, [0x6166]);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_613d Path NZ2: 0x8d44 != 3 -> tail-jump boundary 0x6166", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IY + 0x00, 0x01); // bit0 set
  m.mem.write8(0x8907, 0x00);    // and 0x01 -> Z -> jr nz not taken
  m.mem.write8(0x8d44, 0x02);    // != 3 -> jr nz taken

  loc_613d(m);

  assert.equal(m.tstates, 86, "Path NZ2 T-state total");
  assert.deepEqual(m.pcSeq, [0x6141, 0x6143, 0x6146, 0x6148, 0x614a, 0x614d, 0x614f, 0x6166]);
  assert.equal(m.pc, 0x6166);
  assert.deepEqual(m.calls, [0x6166]);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_613d Path FALL: 0x8d44 == 3 -> seat regs and fall into loc_615d", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IY + 0x00, 0x01); // bit0 set
  m.mem.write8(0x8907, 0x00);    // Z -> jr nz not taken
  m.mem.write8(0x8d44, 0x03);    // == 3 -> jr nz not taken -> fall through
  m.mem.write8(IY + 0x14, 0x2a); // A <- (iy+0x14)

  loc_613d(m);

  assert.equal(m.tstates, 131, "Path FALL T-state total");
  assert.deepEqual(m.pcSeq, [
    0x6141, 0x6143, 0x6146, 0x6148, 0x614a, 0x614d, 0x614f, 0x6151, 0x6154, 0x6158, 0x615b, 0x615d,
  ]);
  assert.equal(m.pc, 0x615d, "fall-through into loc_615d");
  assert.deepEqual(m.calls, [0x615d]);
  assert.equal(m.regs.a, 0x2a, "A seated from (iy+0x14)");
  assert.equal(m.regs.ix, 0x8b70, "IX seated");
  assert.equal(m.regs.de, 0x0018, "DE seated");
  assert.equal(m.regs.b, 0x06, "B seated");
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_613d MUTATION: `ld a,(iy+0x14)` mis-charged 7T (not 19T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x6154 ? 7 : cycles);
  seatCaller(m);
  m.mem.write8(IY + 0x00, 0x01);
  m.mem.write8(0x8907, 0x00);
  m.mem.write8(0x8d44, 0x03);
  m.mem.write8(IY + 0x14, 0x2a);

  loc_613d(m);

  assert.equal(m.tstates, 119, "mutation loses 12 T (19 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, 131, "Path FALL T-state total"),
    /131/,
    "the 131-T golden must fail on the mutant",
  );
});
