// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_672a (ROM 0x672a, Pooyan) -- object descent step. Steps the 16-bit
 * position (ix+5):(ix+6) by (ix+9); until (ix+6) reaches 0x18 it scans three 0x18-byte records at
 * 0x8c48 for a free slot ((iy+1)==0) matching (ix+6). A hit seats the slot and links it; no hit rets.
 * Either merge path bumps state (ix+2), reloads (ix+9)=0x18 and tail-calls loc_381e.
 *
 * The mock's `call` POPS the pushed return (models the callee ret); a call site missing its push16
 * desyncs SP -- the stack tooth. Paths cover: early merge (add no-carry, (ix+6)>=0x18); add-carry +
 * no-slot ret; scan hit iter1 with no-borrow seat; scan free-mismatch skip + hit iter2 with both
 * borrow arms; plus a T-state mutation.
 *
 * Run: node --test games/pooyan/translated/test/loc_672a.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_672a } from "../loc_672a.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x672a, pcSeq: [],
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
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_672a Path 1: add no-carry, (ix+6)>=0x18 -> early merge -> tail loc_381e", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.mem.write8(0x9005, 0x10); // (ix+5)
  m.mem.write8(0x9009, 0x05); // (ix+9)
  m.mem.write8(0x9006, 0x20); // (ix+6) >= 0x18

  loc_672a(m);

  assert.equal(m.tstates, 203, "Path 1 T-state total");
  assert.deepEqual(m.pcSeq, [
    0x4006, 0x6730, 0x6733, 0x6738, 0x673b, 0x673e, 0x6740, 0x6792,
    0x6795, 0x6799, 0x679c, 0x381e, CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [0x4006, 0x381e]);
  assert.equal(m.mem.read8(0x9005), 0x15, "(ix+5) = 0x10 + 0x05");
  assert.equal(m.mem.read8(0x9009), 0x18, "(ix+9) reloaded 0x18");
  assert.equal(m.regs.sp, 0x8780, "stack back to baseline");
});

test("loc_672a Path 2: add carry -> inc (ix+6); scan all busy -> ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.mem.write8(0x9005, 0xf0);
  m.mem.write8(0x9009, 0x20); // 0xf0+0x20 -> carry
  m.mem.write8(0x9006, 0x00); // inc -> 0x01 (< 0x18)
  m.mem.write8(0x8c49, 0x01); // record 0 (iy+1) busy
  m.mem.write8(0x8c61, 0x01); // record 1 busy
  m.mem.write8(0x8c79, 0x01); // record 2 busy

  loc_672a(m);

  assert.equal(m.tstates, 362, "Path 2 T-state total");
  assert.deepEqual(m.pcSeq, [
    0x4006, 0x6730, 0x6733, 0x6735, 0x6738, 0x673b, 0x673e, 0x6740, 0x6742, 0x6746, 0x6749, 0x674b,
    0x674e, 0x674f, 0x6759, 0x675b, 0x674b,
    0x674e, 0x674f, 0x6759, 0x675b, 0x674b,
    0x674e, 0x674f, 0x6759, 0x675b, 0x675d, CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [0x4006]);
  assert.equal(m.mem.read8(0x9006), 0x01, "(ix+6) incremented on carry");
  assert.equal(m.mem.read8(0x9005), 0x10, "(ix+5) = 0xf0 + 0x20");
  assert.equal(m.regs.sp, 0x8780, "stack back to baseline");
});

test("loc_672a Path 3: scan hit iter1, no-borrow seat -> merge -> tail loc_381e", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.mem.write8(0x9005, 0x10);
  m.mem.write8(0x9009, 0x05); // no carry
  m.mem.write8(0x9006, 0x05); // < 0x18 -> scan
  m.mem.write8(0x9003, 0x90); // (ix+3): sub 0x80 no borrow
  m.mem.write8(0x8c49, 0x00); // record 0 free
  m.mem.write8(0x8c4e, 0x05); // (iy+6) == (ix+6)

  loc_672a(m);

  assert.equal(m.tstates, 565, "Path 3 T-state total");
  assert.deepEqual(m.pcSeq, [
    0x4006, 0x6730, 0x6733, 0x6738, 0x673b, 0x673e, 0x6740, 0x6742, 0x6746, 0x6749, 0x674b,
    0x674e, 0x674f, 0x6751, 0x6754, 0x6757, 0x675e,
    0x6761, 0x6762, 0x6766, 0x6769, 0x676b, 0x6770, 0x6773, 0x6776, 0x6778, 0x677d, 0x6780, 0x6784,
    0x6786, 0x6787, 0x678a, 0x678d, 0x678f, 0x6792,
    0x6795, 0x6799, 0x679c, 0x381e, CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [0x4006, 0x381e]);
  assert.equal(m.mem.read8(0x8903), 0x01, "0x8903 bumped on a hit");
  assert.equal(m.mem.read8(0x8c49), 0x02, "(iy+1) seated = 0x02");
  assert.equal(m.mem.read8(0x8c4b), 0x10, "(iy+3) = (ix+3) - 0x80");
  assert.equal(m.mem.read8(0x8c4d), 0x55, "(iy+5) = (ix+5) + 0x40");
  assert.equal(m.mem.read8(0x8c57), 0xc0, "(iy+0xf) = 0xc0");
  assert.equal(m.mem.read8(0x9007), 0x48, "(ix+7) = iy low");
  assert.equal(m.mem.read8(0x9008), 0x8c, "(ix+8) = iy high");
  assert.equal(m.mem.read8(0x8929), 0x20, "0x8929 timer seeded");
  assert.equal(m.regs.sp, 0x8780, "stack back to baseline");
});

test("loc_672a Path 4: scan free-mismatch skip then hit iter2, both borrow arms", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.mem.write8(0x9005, 0xc0); // 0xc0 + 0x00 no carry; + 0x40 later -> carry (borrow arm)
  m.mem.write8(0x9009, 0x00);
  m.mem.write8(0x9006, 0x0a); // < 0x18
  m.mem.write8(0x9003, 0x00); // (ix+3): sub 0x80 -> borrow arm
  m.mem.write8(0x8c49, 0x00); // record 0 free
  m.mem.write8(0x8c4e, 0x99); // (iy+6) mismatch
  m.mem.write8(0x8c61, 0x00); // record 1 free
  m.mem.write8(0x8c66, 0x0a); // (iy+6) match

  loc_672a(m);

  assert.equal(m.tstates, 704, "Path 4 T-state total");
  assert.deepEqual(m.pcSeq, [
    0x4006, 0x6730, 0x6733, 0x6738, 0x673b, 0x673e, 0x6740, 0x6742, 0x6746, 0x6749, 0x674b,
    0x674e, 0x674f, 0x6751, 0x6754, 0x6757, 0x6759, 0x675b, 0x674b,
    0x674e, 0x674f, 0x6751, 0x6754, 0x6757, 0x675e,
    0x6761, 0x6762, 0x6766, 0x6769, 0x676b, 0x676d, 0x6770, 0x6773, 0x6776, 0x6778, 0x677a, 0x677d,
    0x6780, 0x6784, 0x6786, 0x6787, 0x678a, 0x678d, 0x678f, 0x6792,
    0x6795, 0x6799, 0x679c, 0x381e, CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [0x4006, 0x381e]);
  assert.equal(m.mem.read8(0x8c61), 0x02, "record 1 (iy+1) seated");
  assert.equal(m.mem.read8(0x8c64), 0xff, "(iy+4) borrow-decremented 0x00 -> 0xff");
  assert.equal(m.mem.read8(0x8c66), 0x09, "(iy+6) borrow-decremented 0x0a -> 0x09");
  assert.equal(m.mem.read8(0x9007), 0x60, "(ix+7) = iy low (0x8c60)");
  assert.equal(m.mem.read8(0x9008), 0x8c, "(ix+8) = iy high");
  assert.equal(m.regs.sp, 0x8780, "stack back to baseline");
});

test("loc_672a MUTATION: the loc_4006 call mis-charged 16T (not 17T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x4006 ? 16 : cycles);
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.mem.write8(0x9005, 0x10);
  m.mem.write8(0x9009, 0x05);
  m.mem.write8(0x9006, 0x20);

  loc_672a(m);

  assert.equal(m.tstates, 202, "mutation loses 1 T");
  assert.throws(() => assert.equal(m.tstates, 203, "Path 1 T-state total"), /Path 1/);
});
