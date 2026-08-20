// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_5f11 (ROM 0x5f11, Pooyan) -- the djnz collision scan. For each of
 * B slots (IX stride 4, HL stride 0x18) it skips empty (0) / state-3 slots, calls loc_5f53 for the
 * screen coords, range-checks |dx| < 7 and |dy| < 6, and on a hit marks the slot state 3, sets a
 * flash cell at 0x8d19 (+I), then tails into loc_5f02.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling the callee's `ret`), then
 * for loc_5f53 models its net effect (E, A, carry from `cp 0xe0`). Because it pops, a call site that
 * forgot its push16 desyncs SP and the final ret/tail misses its target -- the stack-fidelity tooth.
 *
 * Cases cover every branch: empty-slot skip, state-3 skip, off-screen (jr nc at 0x5f1c), both dx/dy
 * neg vs no-neg paths, both dx/dy range rejects, the I==0 / I!=0 flash-cell split, the djnz loop-back,
 * and the tail jp into loc_5f02. MUTATION tooth: mis-charge `add ix,de` (15T -> 11T).
 *
 * Run: node --test games/pooyan/translated/test/loc_5f11.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5f11 } from "../loc_5f11.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x5f11, pcSeq: [],
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
    // The callee's `ret` pops the return address the call site pushed -- model that pop so the stack
    // stays balanced (a missing push16 then desyncs SP). For loc_5f53 also model its net effect:
    // E <- (ix+0)+bias, A <- (ix+2)+8, carry from `cp 0xe0`. loc_0ef1 (via loc_5f02 tail) just pops.
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      if (addr === 0x5f53) {
        const bias = mem.read8(0x881f) !== 0 ? 0x06 : 0xfe;
        regs.e = (mem.read8((regs.ix + 0) & 0xffff) + bias) & 0xff;
        regs.a = (mem.read8((regs.ix + 2) & 0xffff) + 0x08) & 0xff;
        regs.cp(0xe0);
      }
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_5f11 Path SKIP0: empty slot -> jr z at 0x5f13, one slot, ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.b = 0x01;
  m.regs.ix = 0x9000;
  m.regs.hl = 0x8800;
  m.mem.write8(0x8800, 0x00); // empty slot

  loc_5f11(m);

  assert.equal(m.tstates, 87, "SKIP0 T-state total");
  assert.deepEqual(m.pcSeq, [
    0x5f12, 0x5f13, 0x5f47, 0x5f4a, 0x5f4c, 0x5f4f, 0x5f50, 0x5f52, CALLER_RET,
  ], "empty slot -> advance -> djnz falls out -> ret");
  assert.equal(m.pc, CALLER_RET, "ret to seated caller");
  assert.deepEqual(m.calls, [], "loc_5f53 not called for an empty slot");
  assert.equal(m.regs.ix, 0x9004, "IX advanced by 4");
  assert.equal(m.regs.hl, 0x8818, "HL advanced by 0x18");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_5f11 Path SKIP3: state-3 slot -> jr z at 0x5f17, ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.b = 0x01;
  m.regs.ix = 0x9000;
  m.regs.hl = 0x8800;
  m.mem.write8(0x8800, 0x03); // already state 3

  loc_5f11(m);

  assert.equal(m.tstates, 101, "SKIP3 T-state total");
  assert.deepEqual(m.pcSeq, [
    0x5f12, 0x5f13, 0x5f15, 0x5f17, 0x5f47, 0x5f4a, 0x5f4c, 0x5f4f, 0x5f50, 0x5f52, CALLER_RET,
  ], "cp 0x03 -> jr z -> advance -> ret");
  assert.deepEqual(m.calls, [], "loc_5f53 not called for a state-3 slot");
});

test("loc_5f11 Path OFFSCREEN: loc_5f53 clears carry -> jr nc at 0x5f1c, skip", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.b = 0x01;
  m.regs.ix = 0x9000;
  m.regs.iy = 0xa000;
  m.regs.hl = 0x8800;
  m.mem.write8(0x8800, 0x02);
  m.mem.write8(0x881f, 0x01); // bias 6
  m.mem.write8(0x9000, 0x10);
  m.mem.write8(0x9002, 0xf0); // (ix+2)+8 = 0xf8 >= 0xe0 -> carry clear

  loc_5f11(m);

  assert.equal(m.tstates, 125, "OFFSCREEN T-state total");
  assert.deepEqual(m.pcSeq, [
    0x5f12, 0x5f13, 0x5f15, 0x5f17, 0x5f19, 0x5f53, 0x5f47,
    0x5f4a, 0x5f4c, 0x5f4f, 0x5f50, 0x5f52, CALLER_RET,
  ], "call loc_5f53 -> jr nc skip -> advance -> ret");
  assert.deepEqual(m.calls, [0x5f53], "loc_5f53 called once, then off-screen skip");
  assert.equal(m.mem.read8(0x8800), 0x02, "slot untouched (no hit)");
});

test("loc_5f11 Path HIT (I==0): full box match -> mark slot, flash 0x8d19, tail into loc_5f02", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.b = 0x01;
  m.regs.ix = 0x9000;
  m.regs.iy = 0xa000;
  m.regs.hl = 0x8800;
  m.mem.write8(0x8800, 0x01); // live slot
  m.mem.write8(0x881f, 0x01); // bias 6 (jr nz taken inside loc_5f53)
  m.mem.write8(0x9000, 0x10); // -> E = 0x16
  m.mem.write8(0x9002, 0x20); // -> A = 0x28, carry set
  m.mem.write8(0xa000, 0x18); // (iy+0): dx = 0x18-0x16 = 0x02 (no borrow, < 7)
  m.mem.write8(0xa002, 0x22); // (iy+2)+8 = 0x2a; dy = 0x2a-0x28 = 0x02 (no borrow, < 6)
  // regs.i defaults to 0 -> ld a,i is Z -> jr z, no inc l

  loc_5f11(m);

  assert.equal(m.tstates, 228, "HIT T-state total");
  assert.deepEqual(m.pcSeq, [
    0x5f12, 0x5f13, 0x5f15, 0x5f17, 0x5f19, 0x5f53, 0x5f1e, 0x5f1f, 0x5f22, 0x5f23,
    0x5f27, 0x5f29, 0x5f2b, 0x5f2e, 0x5f30, 0x5f31, 0x5f35, 0x5f37, 0x5f39, 0x5f3b,
    0x5f3e, 0x5f40, 0x5f43, 0x5f45, 0x5f02,
  ], "no-neg dx/dy path, I==0 (jr z at 0x5f40), tail into loc_5f02");
  assert.equal(m.pc, 0x5f02, "tail jp lands on loc_5f02");
  assert.deepEqual(m.calls, [0x5f53, 0x5f02], "loc_5f53 then the loc_5f02 tail");
  assert.equal(m.mem.read8(0x8800), 0x03, "slot marked state 3");
  assert.equal(m.mem.read8(0x8d19), 0x01, "flash cell 0x8d19 set (I==0, no inc l)");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound (push16 matched by callee ret)");
});

test("loc_5f11 Path HIT-NEG (I!=0): dx/dy via neg, flash 0x8d1a (inc l), tail into loc_5f02", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.b = 0x01;
  m.regs.ix = 0x9000;
  m.regs.iy = 0xa000;
  m.regs.hl = 0x8800;
  m.regs.i = 0x01;            // I != 0 -> ld a,i is NZ -> inc l
  m.mem.write8(0x8800, 0x01);
  m.mem.write8(0x881f, 0x00); // bias -2 (jr nz NOT taken inside loc_5f53)
  m.mem.write8(0x9000, 0x30); // -> E = 0x30 + 0xfe = 0x2e
  m.mem.write8(0x9002, 0x10); // -> A = 0x18, carry set
  m.mem.write8(0xa000, 0x2a); // dx = 0x2a-0x2e = 0xfc -> neg -> 0x04 (< 7)
  m.mem.write8(0xa002, 0x0c); // (iy+2)+8 = 0x14; dy = 0x14-0x18 = 0xfc -> neg -> 0x04 (< 6)

  loc_5f11(m);

  assert.equal(m.tstates, 233, "HIT-NEG T-state total");
  assert.deepEqual(m.pcSeq, [
    0x5f12, 0x5f13, 0x5f15, 0x5f17, 0x5f19, 0x5f53, 0x5f1e, 0x5f1f, 0x5f22, 0x5f23,
    0x5f25, 0x5f27, 0x5f29, 0x5f2b, 0x5f2e, 0x5f30, 0x5f31, 0x5f33, 0x5f35, 0x5f37,
    0x5f39, 0x5f3b, 0x5f3e, 0x5f40, 0x5f42, 0x5f43, 0x5f45, 0x5f02,
  ], "both negs (0x5f25, 0x5f33), inc l at 0x5f42, tail into loc_5f02");
  assert.deepEqual(m.calls, [0x5f53, 0x5f02]);
  assert.equal(m.mem.read8(0x8800), 0x03, "slot marked state 3");
  assert.equal(m.mem.read8(0x8d1a), 0x01, "flash cell 0x8d1a set (I!=0 -> inc l)");
  assert.equal(m.mem.read8(0x8d19), 0x00, "0x8d19 untouched when inc l applied");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound");
});

test("loc_5f11 Path DX-REJECT: |dx| >= 7 -> jr nc at 0x5f29, skip", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.b = 0x01;
  m.regs.ix = 0x9000;
  m.regs.iy = 0xa000;
  m.regs.hl = 0x8800;
  m.mem.write8(0x8800, 0x02);
  m.mem.write8(0x881f, 0x01); // bias 6
  m.mem.write8(0x9000, 0x10); // E = 0x16
  m.mem.write8(0x9002, 0x20); // A = 0x28, carry set
  m.mem.write8(0xa000, 0x30); // dx = 0x30-0x16 = 0x1a (>= 7) -> reject

  loc_5f11(m);

  assert.equal(m.tstates, 178, "DX-REJECT T-state total");
  assert.deepEqual(m.pcSeq, [
    0x5f12, 0x5f13, 0x5f15, 0x5f17, 0x5f19, 0x5f53, 0x5f1e, 0x5f1f, 0x5f22, 0x5f23,
    0x5f27, 0x5f29, 0x5f47, 0x5f4a, 0x5f4c, 0x5f4f, 0x5f50, 0x5f52, CALLER_RET,
  ], "cp 0x07 -> jr nc reject -> advance -> ret");
  assert.deepEqual(m.calls, [0x5f53]);
  assert.equal(m.mem.read8(0x8800), 0x02, "slot untouched");
});

test("loc_5f11 Path DY-REJECT: |dy| >= 6 -> jr nc at 0x5f37, skip", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.b = 0x01;
  m.regs.ix = 0x9000;
  m.regs.iy = 0xa000;
  m.regs.hl = 0x8800;
  m.mem.write8(0x8800, 0x02);
  m.mem.write8(0x881f, 0x01); // bias 6
  m.mem.write8(0x9000, 0x10); // E = 0x16
  m.mem.write8(0x9002, 0x20); // A = 0x28, carry set
  m.mem.write8(0xa000, 0x18); // dx = 0x02 (< 7, no neg)
  m.mem.write8(0xa002, 0x40); // (iy+2)+8 = 0x48; dy = 0x48-0x28 = 0x20 (>= 6) -> reject

  loc_5f11(m);

  assert.equal(m.tstates, 234, "DY-REJECT T-state total");
  assert.deepEqual(m.pcSeq, [
    0x5f12, 0x5f13, 0x5f15, 0x5f17, 0x5f19, 0x5f53, 0x5f1e, 0x5f1f, 0x5f22, 0x5f23,
    0x5f27, 0x5f29, 0x5f2b, 0x5f2e, 0x5f30, 0x5f31, 0x5f35, 0x5f37, 0x5f47, 0x5f4a,
    0x5f4c, 0x5f4f, 0x5f50, 0x5f52, CALLER_RET,
  ], "cp 0x06 -> jr nc reject -> advance -> ret");
  assert.deepEqual(m.calls, [0x5f53]);
});

test("loc_5f11 Path LOOP: B=2, iter1 dx-reject -> djnz back, iter2 empty -> ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.b = 0x02;
  m.regs.ix = 0x9000;
  m.regs.iy = 0xa000;
  m.regs.hl = 0x8800;
  m.mem.write8(0x881f, 0x01); // bias 6
  // iter1 slot: live, dx too big -> reject at 0x5f29
  m.mem.write8(0x8800, 0x02);
  m.mem.write8(0x9000, 0x10); // E = 0x16
  m.mem.write8(0x9002, 0x20); // A = 0x28, carry set
  m.mem.write8(0xa000, 0x30); // dx = 0x1a (>= 7)
  // iter2 slot (HL += 0x18 -> 0x8818): empty -> skip at 0x5f13
  m.mem.write8(0x8818, 0x00);

  loc_5f11(m);

  assert.equal(m.tstates, 260, "LOOP T-state total (two iterations)");
  assert.deepEqual(m.pcSeq, [
    // iter1
    0x5f12, 0x5f13, 0x5f15, 0x5f17, 0x5f19, 0x5f53, 0x5f1e, 0x5f1f, 0x5f22, 0x5f23,
    0x5f27, 0x5f29, 0x5f47, 0x5f4a, 0x5f4c, 0x5f4f, 0x5f50, 0x5f11,
    // iter2
    0x5f12, 0x5f13, 0x5f47, 0x5f4a, 0x5f4c, 0x5f4f, 0x5f50, 0x5f52, CALLER_RET,
  ], "djnz loops back to 0x5f11, second slot empty, ret");
  assert.deepEqual(m.calls, [0x5f53], "loc_5f53 called only for the live iter1 slot");
  assert.equal(m.regs.ix, 0x9008, "IX advanced twice (4+4)");
  assert.equal(m.regs.hl, 0x8830, "HL advanced twice (0x18+0x18)");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_5f11 MUTATION: `add ix,de` mis-charged 11T (not 15T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x5f4c ? 11 : cycles);
  seatCaller(m);
  m.regs.b = 0x01;
  m.regs.ix = 0x9000;
  m.regs.hl = 0x8800;
  m.mem.write8(0x8800, 0x00);

  loc_5f11(m);

  assert.equal(m.tstates, 83, "mutation loses 4 T (15 -> 11)");
  assert.throws(
    () => assert.equal(m.tstates, 87, "SKIP0 T-state total"),
    /87/,
    "the 87-T golden must fail on the mutant",
  );
});
