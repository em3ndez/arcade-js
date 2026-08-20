// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_6435 (ROM 0x6435, Pooyan) -- the proximity/collision scan for the
 * actor at IY. Selects the object table by 0x8f50, then scans B=3 objects (via the inlined 0x6429
 * latch): a hit needs an active slot (mem[HL]!=0) within +/-7 of IY in X and Y (5- or -2-pixel bias
 * per 0x881f). No hit rets to the caller; a hit resets the object, sets a state byte at 0x8d1b/0x8d1c
 * (per `ld a,i`), enqueues effects (loc_381e, loc_0ef5, rst 0x38), bumps 0x8f52, and falls into loc_64be.
 *
 * The mock POPS on each call to model the callee's ret consuming the pushed return (a missing push16
 * then desyncs the stack and fails the balance tooth -- the batch-5 defect). The tail into loc_64be
 * pops TWICE (loc_64be's `pop af` + `ret` are a skip-return), so the collision tests seat two words.
 *
 * Path HIT-A: player-1 table (0x8f50==0), e=+5, X close (skip neg) / Y close (neg), i==0 (0x8d1b),
 *   0x8f50==0 so the rst-0x38 enqueue runs. Full pcSeq + T=565.
 * Path HIT-B: player-2 table (0x8f50!=0), e=-2, X close (neg) / Y close (skip neg), i!=0 (0x8d1c),
 *   0x8f50!=0 so the rst enqueue is skipped. Full pcSeq + T=575.
 * Path MISS: 3 objects, none a hit (X-too-far, then Y-too-far, then empty slot), latch exhausts B,
 *   ret to caller. Full pcSeq + T=651. TEETH: mis-charge `ld a,(ix+0x00)` (19 T) as 13 T -> the 565 golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_6435.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6435 } from "../loc_6435.js";

const CALLER_RET = 0xabcd; // loc_6435's own return (dropped by loc_64be's `pop af` on a hit)
const GRAND_RET = 0x1234;  // the caller's caller (landed on by loc_64be's `ret` on a hit)

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x6435, pcSeq: [],
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
    call(addr) {
      this.calls.push(addr);
      this.pop16(); // callee's ret consumes the pushed return (for 0x64be this models its `pop af`)
      if (addr === 0x64be) this.pop16(); // loc_64be additionally `ret`s -> its second stack read
      return undefined;
    },
  };
}

function seatHit(m) {
  m.regs.sp = 0x8780;
  m.push16(GRAND_RET);
  m.push16(CALLER_RET);
}

function seatPlain(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

const PC_HIT_A = [
  0x6439, 0x643c, 0x643f, 0x6440, 0x6449, 0x644b, // prologue, player-1 table
  0x644c, 0x644d, 0x644f, 0x6451, 0x6454, 0x6455, 0x6459, // active slot, e=+5
  0x645c, 0x645d, 0x645e, 0x6461, 0x6463, 0x6464, // biased X/Y
  0x6467, 0x6468, 0x646c, 0x646e, // X: sub e, skip neg, cp7 close
  0x6470, 0x6473, 0x6475, 0x6476, 0x6478, 0x647a, 0x647c, 0x647e, // Y: neg, cp7 close -> HIT
  0x647f, 0x6481, 0x6485, 0x6489, 0x648d, 0x6491, 0x6494, 0x6497, 0x6499, 0x649a, 0x649f, // reset, i==0
  0x64a1, 0x64a4, 0x381e, 0x0ef5, // ld (hl),1; ld de; call 0x381e; call 0x0ef5
  0x64ad, 0x64ae, 0x64b0, 0x64b3, 0x0038, // 0x8f50==0 -> rst 0x38
  0x64b7, 0x64b8, 0x64bb, 0x64be, // bump 0x8f52, fall into loc_64be
];

test("loc_6435 Path HIT-A: player-1 hit, rst enqueue runs, falls into loc_64be", () => {
  const m = makeMachine();
  seatHit(m);
  m.regs.iy = 0x9000;
  m.mem.write8(0x8f50, 0x00);  // player-1 tables + rst runs
  m.mem.write8(0x8c48, 0x01);  // active slot (object 0)
  m.mem.write8(0x881f, 0x01);  // e = +5
  m.mem.write8(0x888c, 0x10);  // object X ref
  m.mem.write8(0x888e, 0x20);  // object Y ref
  m.mem.write8(0x9000, 0x18);  // actor X (|0x18-0x15|=3 < 7, skip neg)
  m.mem.write8(0x9002, 0x1c);  // actor Y (|0x24-0x28|=4 < 7 via neg)

  loc_6435(m);

  assert.equal(m.tstates, 565, "Path HIT-A T-state total");
  assert.deepEqual(m.pcSeq, PC_HIT_A, "step boundaries match the ROM bytes");
  assert.equal(m.pc, 0x64be, "fall-through lands on loc_64be");
  assert.deepEqual(m.calls, [0x381e, 0x0ef5, 0x0038, 0x64be], "effects + fall-through delegate");
  assert.equal(m.regs.ix, 0x8c48, "IX = HL (the hit object)");
  assert.equal(m.mem.read8(0x8c48), 0x00, "object byte 0 reset");
  assert.equal(m.mem.read8(0x8c49), 0x01, "object byte 1");
  assert.equal(m.mem.read8(0x8c4a), 0x02, "object byte 2");
  assert.equal(m.mem.read8(0x8c59), 0x20, "object byte +0x11");
  assert.equal(m.mem.read8(0x8d1b), 0x01, "state byte at 0x8d1b (i==0 branch)");
  assert.equal(m.mem.read8(0x8f52), 0x01, "0x8f52 counter bumped");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound (loc_64be's pop af + ret consumed both seated words)");
});

const PC_HIT_B = [
  0x6439, 0x643c, 0x643f, 0x6440, 0x6442, 0x6446, 0x6449, 0x644b, // prologue, player-2 table
  0x644c, 0x644d, 0x644f, 0x6451, 0x6454, 0x6455, 0x6457, 0x6459, // active slot, e=-2
  0x645c, 0x645d, 0x645e, 0x6461, 0x6463, 0x6464, // biased X/Y
  0x6467, 0x6468, 0x646a, 0x646c, 0x646e, // X: sub e, neg, cp7 close
  0x6470, 0x6473, 0x6475, 0x6476, 0x647a, 0x647c, 0x647e, // Y: skip neg, cp7 close -> HIT
  0x647f, 0x6481, 0x6485, 0x6489, 0x648d, 0x6491, 0x6494, 0x6497, 0x6499, 0x649a, 0x649c, 0x649f, // reset, i!=0
  0x64a1, 0x64a4, 0x381e, 0x0ef5,
  0x64ad, 0x64ae, 0x64b4, // 0x8f50!=0 -> skip rst
  0x64b7, 0x64b8, 0x64bb, 0x64be,
];

test("loc_6435 Path HIT-B: player-2 hit, rst enqueue skipped, i!=0 branch", () => {
  const m = makeMachine();
  seatHit(m);
  m.regs.iy = 0x9000;
  m.regs.i = 0x40;             // ld a,i -> nonzero -> 0x8d1c branch
  m.mem.write8(0x8f50, 0x01);  // player-2 tables + skip rst
  m.mem.write8(0x8be8, 0x01);  // active slot
  m.mem.write8(0x881f, 0x00);  // e = -2 (0xfe)
  m.mem.write8(0x887c, 0x10);  // object X ref
  m.mem.write8(0x887e, 0x20);  // object Y ref
  m.mem.write8(0x9000, 0x08);  // actor X (|0x08-0x0e|=6 < 7 via neg)
  m.mem.write8(0x9002, 0x22);  // actor Y (|0x2a-0x28|=2 < 7, skip neg)

  loc_6435(m);

  assert.equal(m.tstates, 575, "Path HIT-B T-state total");
  assert.deepEqual(m.pcSeq, PC_HIT_B, "step boundaries match the ROM bytes");
  assert.equal(m.pc, 0x64be, "fall-through lands on loc_64be");
  assert.deepEqual(m.calls, [0x381e, 0x0ef5, 0x64be], "no rst-0x38 on the skip path");
  assert.equal(m.regs.ix, 0x8be8, "IX = HL (the hit object)");
  assert.equal(m.mem.read8(0x8be8), 0x00, "object byte 0 reset");
  assert.equal(m.mem.read8(0x8bf9), 0x20, "object byte +0x11");
  assert.equal(m.mem.read8(0x8d1c), 0x01, "state byte at 0x8d1c (i!=0 branch)");
  assert.equal(m.mem.read8(0x8d1b), 0x00, "0x8d1b untouched on the i!=0 branch");
  assert.equal(m.mem.read8(0x8f52), 0x01, "0x8f52 counter bumped");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound");
});

const PC_MISS = [
  0x6439, 0x643c, 0x643f, 0x6440, 0x6449, 0x644b, // prologue
  // iter1: active, X too far -> latch
  0x644c, 0x644d, 0x644f, 0x6451, 0x6454, 0x6455, 0x6459,
  0x645c, 0x645d, 0x645e, 0x6461, 0x6463, 0x6464, 0x6467, 0x6468, 0x646c, 0x646e,
  0x6429, 0x642c, 0x642e, 0x6431, 0x6432, 0x644b,
  // iter2: active, X close, Y too far -> latch
  0x644c, 0x644d, 0x644f, 0x6451, 0x6454, 0x6455, 0x6459,
  0x645c, 0x645d, 0x645e, 0x6461, 0x6463, 0x6464, 0x6467, 0x6468, 0x646c, 0x646e,
  0x6470, 0x6473, 0x6475, 0x6476, 0x647a, 0x647c,
  0x6429, 0x642c, 0x642e, 0x6431, 0x6432, 0x644b,
  // iter3: empty slot -> latch, B exhausts -> ret
  0x644c, 0x644d, 0x6429, 0x642c, 0x642e, 0x6431, 0x6432, 0x6434, CALLER_RET,
];

test("loc_6435 Path MISS: no object within range, latch exhausts B -> ret", () => {
  const m = makeMachine();
  seatPlain(m);
  m.regs.iy = 0x9000;
  m.mem.write8(0x8f50, 0x00);  // player-1 tables
  m.mem.write8(0x881f, 0x01);  // e = +5 for the active iterations
  // iter1 object 0x8c48 (ix 0x888c): active, X too far
  m.mem.write8(0x8c48, 0x01);
  m.mem.write8(0x888c, 0x00);
  m.mem.write8(0x888e, 0x00);
  // iter2 object 0x8c60 (ix 0x8890): active, X close, Y too far
  m.mem.write8(0x8c60, 0x01);
  m.mem.write8(0x8890, 0x1b);
  m.mem.write8(0x8892, 0x00);
  // iter3 object 0x8c78: empty slot
  m.mem.write8(0x8c78, 0x00);
  m.mem.write8(0x9000, 0x20);  // actor X
  m.mem.write8(0x9002, 0x20);  // actor Y

  loc_6435(m);

  assert.equal(m.tstates, 651, "Path MISS T-state total");
  assert.deepEqual(m.pcSeq, PC_MISS, "step boundaries match the ROM bytes");
  assert.equal(m.pc, CALLER_RET, "ret to the seated caller");
  assert.deepEqual(m.calls, [], "no effects enqueued on a miss");
  assert.equal(m.regs.b, 0x00, "B exhausted");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound (latch ret consumed CALLER_RET)");
  assert.equal(m.mem.read8(0x8f52), 0x00, "no counter bump on a miss");
});

test("loc_6435 MUTATION: `ld a,(ix+0x00)` mis-charged 13T (not 19T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x645c ? 13 : cycles);
  seatHit(m);
  m.regs.iy = 0x9000;
  m.mem.write8(0x8f50, 0x00);
  m.mem.write8(0x8c48, 0x01);
  m.mem.write8(0x881f, 0x01);
  m.mem.write8(0x888c, 0x10);
  m.mem.write8(0x888e, 0x20);
  m.mem.write8(0x9000, 0x18);
  m.mem.write8(0x9002, 0x1c);

  loc_6435(m);

  assert.equal(m.tstates, 559, "mutation loses 6 T (19 -> 13)");
  assert.throws(() => assert.equal(m.tstates, 565, "golden"), /565/, "the 565-T golden must fail on the mutant");
});
