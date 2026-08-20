// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_630f (ROM 0x630f, Pooyan) -- the bounding-box proximity test.
 * E biases IX.x by +6 (0x881f set) or -2 (clear); |IX.x+E - IY.x| and |(IY.y+8)-(IX.y+8)| are
 * each tested < 5. Either axis out of range -> tail jp 0x60f2 (miss); both within -> tail jp 0x60d9.
 *
 * loc_630f has NO CALL of its own -- it reaches every exit via a tail jp, so the seated CALLER_RET
 * is consumed by the tail target's `ret` (modelled by the popping mock `call`). Every path therefore
 * unwinds SP to the pre-seat baseline. The mock's `call` POPS to model that ret.
 *
 * Paths: HIT (0x881f set, dx no-neg, dy neg, both <5 -> jp 0x60d9); MISS-X (0x881f clear -> E=-2,
 * dx>=5 -> first jp nc taken to 0x60f2); MISS-Y (dx neg then <5, dy>=5 -> second jp nc taken to
 * 0x60f2). Together they cover both jr nz outcomes, both jr nc(dx)/jr nc(dy) outcomes, and all
 * three jp exits. TEETH: mis-charge `cp 0x05` (7T) as 4T -> the golden total catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_630f.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_630f } from "../loc_630f.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x630f, pcSeq: [],
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
    // The tail target's `ret` consumes whatever was on the stack -- for a tail jp that is the seated
    // CALLER_RET. Popping here keeps SP honest: were a push16 ever added at a call site (there are
    // none here) or dropped, the final SP baseline assertion would catch the desync.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_630f Path HIT: both axes within 5 -> tail jp 0x60d9", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x881f, 0x01);       // set -> keep +6 bias (jr nz taken)
  m.regs.ix = 0x9000; m.regs.iy = 0x9100;
  m.mem.write8(0x9000, 0x10);       // IX.x
  m.mem.write8(0x9002, 0x20);       // IX.y
  m.mem.write8(0x9100, 0x18);       // IY.x: dx = 0x18-(0x10+6)=2, no neg, <5
  m.mem.write8(0x9102, 0x1e);       // IY.y: (0x1e+8)-(0x20+8)=-2 -> neg -> 2, <5

  loc_630f(m);

  assert.equal(m.tstates, 217, "Path HIT T-state total");
  assert.deepEqual(m.pcSeq, [
    0x6311, 0x6314, 0x6315, 0x6319, 0x631c, 0x631d, 0x631e, 0x6321, 0x6323, 0x6324,
    0x6327, 0x6328, 0x632c, 0x632e, 0x6331, 0x6334, 0x6336, 0x6337, 0x6339, 0x633b,
    0x633d, 0x6340, 0x60d9,
  ], "HIT visits the tail target 0x60d9");
  assert.equal(m.pc, 0x60d9, "tail jp lands on 0x60d9");
  assert.deepEqual(m.calls, [0x60d9], "single tail jp to 0x60d9");
  assert.equal(m.regs.e, 0x16, "E = IX.x + 6");
  assert.equal(m.regs.d, 0x28, "D = IX.y + 8");
  assert.equal(m.regs.sp, 0x8780, "SP unwound to baseline (tail target's ret popped CALLER_RET)");
});

test("loc_630f Path MISS-X: 0x881f clear -> E=-2, dx>=5 -> tail jp 0x60f2", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x881f, 0x00);       // clear -> E=0xfe (jr nz not taken)
  m.regs.ix = 0x9000; m.regs.iy = 0x9100;
  m.mem.write8(0x9000, 0x10);       // IX.x; E = 0x10 + 0xfe = 0x0e
  m.mem.write8(0x9002, 0x20);
  m.mem.write8(0x9100, 0x20);       // IY.x: dx = 0x20-0x0e = 0x12 (18) >= 5 -> miss

  loc_630f(m);

  assert.equal(m.tstates, 147, "Path MISS-X T-state total");
  assert.deepEqual(m.pcSeq, [
    0x6311, 0x6314, 0x6315, 0x6317, 0x6319, 0x631c, 0x631d, 0x631e, 0x6321, 0x6323,
    0x6324, 0x6327, 0x6328, 0x632c, 0x632e, 0x60f2,
  ], "E=-2 branch, first jp nc taken to 0x60f2");
  assert.equal(m.pc, 0x60f2, "first miss tail jp lands on 0x60f2");
  assert.deepEqual(m.calls, [0x60f2]);
  assert.equal(m.regs.e, 0x0e, "E = IX.x - 2");
  assert.equal(m.regs.sp, 0x8780, "SP unwound to baseline");
});

test("loc_630f Path MISS-Y: dx neg <5, dy>=5 -> second jp nc taken to 0x60f2", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x881f, 0x01);       // set -> +6 bias
  m.regs.ix = 0x9000; m.regs.iy = 0x9100;
  m.mem.write8(0x9000, 0x20);       // IX.x; E = 0x26
  m.mem.write8(0x9002, 0x10);       // IX.y; D = 0x18
  m.mem.write8(0x9100, 0x24);       // IY.x: dx = 0x24-0x26 = -2 -> neg -> 2, <5
  m.mem.write8(0x9102, 0x30);       // IY.y: (0x30+8)-0x18 = 0x20 (32) >= 5 -> miss

  loc_630f(m);

  assert.equal(m.tstates, 207, "Path MISS-Y T-state total");
  assert.deepEqual(m.pcSeq, [
    0x6311, 0x6314, 0x6315, 0x6319, 0x631c, 0x631d, 0x631e, 0x6321, 0x6323, 0x6324,
    0x6327, 0x6328, 0x632a, 0x632c, 0x632e, 0x6331, 0x6334, 0x6336, 0x6337, 0x633b,
    0x633d, 0x60f2,
  ], "dx neg branch, second jp nc taken to 0x60f2");
  assert.equal(m.pc, 0x60f2, "second miss tail jp lands on 0x60f2");
  assert.deepEqual(m.calls, [0x60f2]);
  assert.equal(m.regs.sp, 0x8780, "SP unwound to baseline");
});

test("loc_630f MUTATION: `cp 0x05` mis-charged 4T (not 7T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  // mis-charge the first cp 0x05 (steps to 0x632e) as 4T
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x632e ? 4 : cycles);
  seatCaller(m);
  m.mem.write8(0x881f, 0x01);
  m.regs.ix = 0x9000; m.regs.iy = 0x9100;
  m.mem.write8(0x9000, 0x10);
  m.mem.write8(0x9002, 0x20);
  m.mem.write8(0x9100, 0x18);
  m.mem.write8(0x9102, 0x1e);

  loc_630f(m);

  assert.equal(m.tstates, 214, "mutation loses 3 T (7 -> 4)");
  assert.throws(
    () => assert.equal(m.tstates, 217, "Path HIT T-state total"),
    /217/,
    "the 217-T golden must fail on the mutant",
  );
});
