// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_4221 (ROM 0x4221, Pooyan) -- an object state handler (m.call dispatch
 * target). Ticks loc_4006, branches on (ix+0x08) bit0, reads (ix+0x06)&0x1f as a phase timer, and either
 * arms an animation script (T1 0x423a script 0x4212 / T2 0x425c script 0x4203, both tail-jp loc_381e),
 * runs the string-match tail M (0x4266), or drops into the shared bookkeeping tail P (0x4290).
 *
 * The mock's `call` POPS the return address the call site pushed (modelling the callee's `ret`), so a
 * missing push16 desyncs the stack. The interior callees (0x343e/0x34f2/0x3553/0x42da) touch only
 * registers the routine reloads from memory right after, so a no-op-but-pop mock is faithful here.
 *
 * Every branch is exercised: bit0 (T1/M/T2/P entries), both cp thresholds, ret nc/ret c/ret z, the
 * 0x4273 match loop (mismatch exit + terminator exit + back-edge), the 0x4290 tail's 0x8d5b/0x8d5a
 * gates, the 0x42b4 slot scan (found + exhausted + djnz), and the 0x42cf clear loop. MUTATION: the
 * 0x4228 bit (20 T) mis-charged 8 T -> the 157-T T1 golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_4221.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_4221 } from "../loc_4221.js";

const CALLER_RET = 0xabcd;
const IX = 0x8c00;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x4221, pcSeq: [],
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
    // The callee's `ret` pops the return address the call site pushed -- model that pop so a missing
    // push16 desyncs the stack and the final unwind misses CALLER_RET.
    call(addr) {
      this.calls.push(addr);
      this.pc = this.pop16();
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_4221 T1: bit0 clear, (ix+0x06)&0x1f >= 0x14 -> arm script 0x4212, tail loc_381e", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0x08, 0x00); // bit0 clear -> Apath
  m.mem.write8(IX + 0x06, 0x14); // &0x1f = 0x14, not < 0x14 -> T1

  loc_4221(m);

  assert.equal(m.tstates, 157, "T1 T-state total");
  assert.deepEqual(m.pcSeq, [
    0x4006, 0x4228, 0x422a, 0x343e, 0x4230, 0x4232, 0x4234, 0x4236,
    0x423a, 0x423d, 0x423e, 0x4241, 0x381e,
  ]);
  assert.equal(m.pc, CALLER_RET, "loc_381e ran + ret'd to caller; dispatch verified by pcSeq/m.calls");
  assert.deepEqual(m.calls, [0x4006, 0x343e, 0x381e]);
  assert.equal(m.mem.read8(IX + 0x08), 0x01, "(ix+0x08) set to 1");
  assert.equal(m.mem.read8(0x8d4b), 0x00, "0x8d4b cleared (xor a)");
  assert.equal(m.regs.de, 0x4212, "DE = script pointer 0x4212");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
});

test("loc_4221 T2: bit0 set, A<0x0a, (0x8901)>=2 -> arm script 0x4203, tail loc_381e", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0x08, 0x01); // bit0 set -> Bpath
  m.mem.write8(IX + 0x06, 0x05); // &0x1f = 5, < 0x0a -> not to P
  m.mem.write8(0x8901, 0x02);    // >= 2 -> not to M -> T2

  loc_4221(m);

  assert.equal(m.tstates, 208, "T2 T-state total");
  assert.deepEqual(m.pcSeq, [
    0x4006, 0x4228, 0x4244, 0x34f2, 0x424a, 0x424c, 0x424e, 0x4250, 0x4251, 0x4254, 0x4256,
    0x4258, 0x425c, 0x425f, 0x4261, 0x4264, 0x4241, 0x381e,
  ]);
  assert.equal(m.pc, CALLER_RET, "loc_381e ran + ret'd to caller; dispatch verified by pcSeq/m.calls");
  assert.deepEqual(m.calls, [0x4006, 0x34f2, 0x381e]);
  assert.equal(m.mem.read8(IX + 0x08), 0x00, "(ix+0x08) cleared to 0");
  assert.equal(m.mem.read8(0x8d4b), 0xff, "0x8d4b = 0xff");
  assert.equal(m.regs.de, 0x4203, "DE = script pointer 0x4203");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
});

test("loc_4221 M ret nc: bit0 set, A<0x0a, (0x8901)<2, B>=2 -> ret nc", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0x08, 0x01);
  m.mem.write8(IX + 0x06, 0x05); // B = A = 5 (>= 2)
  m.mem.write8(0x8901, 0x00);    // < 2 -> M

  loc_4221(m);

  assert.equal(m.tstates, 164, "M ret-nc T-state total");
  assert.deepEqual(m.pcSeq, [
    0x4006, 0x4228, 0x4244, 0x34f2, 0x424a, 0x424c, 0x424e, 0x4250, 0x4251, 0x4254, 0x4256,
    0x4266, 0x4267, 0x4269, CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET, "ret nc at 0x4269");
  assert.deepEqual(m.calls, [0x4006, 0x34f2]);
  assert.equal(m.regs.b, 0x05, "B holds A");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_4221 M mismatch: B<2, first (de)+(hl) nonzero -> bump 0x8a3a, ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0x08, 0x01);
  m.mem.write8(IX + 0x06, 0x01); // B = A = 1 (< 2)
  m.mem.write8(0x8901, 0x00);
  m.mem.write8(0x0bb9, 0x01);    // (de)
  m.mem.write8(0x4283, 0x01);    // (hl) -> add = 0x02, nz -> mismatch

  loc_4221(m);

  assert.equal(m.tstates, 252, "M mismatch T-state total");
  assert.deepEqual(m.pcSeq, [
    0x4006, 0x4228, 0x4244, 0x34f2, 0x424a, 0x424c, 0x424e, 0x4250, 0x4251, 0x4254, 0x4256,
    0x4266, 0x4267, 0x4269, 0x426a, 0x3553, 0x4270, 0x4273, 0x4274, 0x4275,
    0x427e, 0x4281, 0x4282, CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET, "ret at 0x4282");
  assert.deepEqual(m.calls, [0x4006, 0x34f2, 0x3553]);
  assert.equal(m.mem.read8(0x8a3a), 0x01, "0x8a3a bumped 0 -> 1");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_4221 M terminator: match loops (back-edge), then 0xff terminator -> ret z", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0x08, 0x01);
  m.mem.write8(IX + 0x06, 0x01);
  m.mem.write8(0x8901, 0x00);
  // iter1: (0x0bb9)+(0x4283)=0 -> match; (0x4284)=0x05 -> inc a nonzero -> jr 0x4273
  m.mem.write8(0x0bb9, 0x00);
  m.mem.write8(0x4283, 0x00);
  m.mem.write8(0x4284, 0x05);
  // iter2: (0x0bb8)+(0x4284)=0 -> match; (0x4285)=0xff -> inc a == 0 -> ret z
  m.mem.write8(0x0bb8, 0xfb);
  m.mem.write8(0x4285, 0xff);

  loc_4221(m);

  assert.equal(m.tstates, 311, "M terminator T-state total");
  assert.deepEqual(m.pcSeq, [
    0x4006, 0x4228, 0x4244, 0x34f2, 0x424a, 0x424c, 0x424e, 0x4250, 0x4251, 0x4254, 0x4256,
    0x4266, 0x4267, 0x4269, 0x426a, 0x3553, 0x4270, 0x4273,
    0x4274, 0x4275, 0x4277, 0x4278, 0x4279, 0x427a, 0x427b, 0x427c, 0x4273, // iter1 (jr back)
    0x4274, 0x4275, 0x4277, 0x4278, 0x4279, 0x427a, 0x427b, CALLER_RET,     // iter2 -> ret z
  ]);
  assert.equal(m.pc, CALLER_RET, "ret z at 0x427b");
  assert.deepEqual(m.calls, [0x4006, 0x34f2, 0x3553]);
  assert.equal(m.mem.read8(0x8a3a), 0x00, "no bump on the terminator path");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_4221 P ret c: Apath, A in [0x05,0x13] but < 0x05 test -> ret c", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0x08, 0x00);
  m.mem.write8(IX + 0x06, 0x03); // < 0x14 -> P; < 0x05 -> ret c

  loc_4221(m);

  assert.equal(m.tstates, 124, "P ret-c T-state total");
  assert.deepEqual(m.pcSeq, [
    0x4006, 0x4228, 0x422a, 0x343e, 0x4230, 0x4232, 0x4234, 0x4290, 0x4292, CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET, "ret c at 0x4292");
  assert.deepEqual(m.calls, [0x4006, 0x343e]);
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_4221 P -> C9: Bpath jr nc taken, (0x8d5b) nonzero -> clear-table loop", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0x08, 0x01); // bit0 set -> Bpath
  m.mem.write8(IX + 0x06, 0x0a); // &0x1f = 0x0a, >= 0x0a -> jr nc taken -> P
  m.mem.write8(0x8d5b, 0x01);    // nonzero -> jr nz -> 0x42c9

  loc_4221(m);

  assert.equal(m.tstates, 347, "P->C9 T-state total");
  assert.deepEqual(m.pcSeq, [
    0x4006, 0x4228, 0x4244, 0x34f2, 0x424a, 0x424c, 0x424e, 0x4290, 0x4292, 0x4293,
    0x4296, 0x4297, 0x4298, 0x42c9, 0x42cd, 0x42cf,
    0x42da, 0x42d5, 0x42d7, 0x42cf, 0x42da, 0x42d5, 0x42d7, 0x42cf, 0x42da, 0x42d5, 0x42d7, 0x42d9,
    CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET, "ret at 0x42d9");
  assert.deepEqual(m.calls, [0x4006, 0x34f2, 0x42da, 0x42da, 0x42da]);
  assert.equal(m.regs.iy, 0x8c90, "IY = 0x8c48 + 3*0x18");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_4221 P cooldown active: (0x8d5b)=0, (0x8d5a) nonzero -> dec (hl); ret at 0x42a0", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0x08, 0x00);
  m.mem.write8(IX + 0x06, 0x06); // < 0x14 -> P, >= 5 (no ret c)
  m.mem.write8(0x8d5b, 0x00);    // -> jr nz not taken
  m.mem.write8(0x8d5a, 0x03);    // nonzero -> jr z NOT taken -> dec (hl) at 0x429f then ret at 0x42a0

  loc_4221(m);

  // 429d jr z not taken (7) -> 429f dec (hl) (11) -> 42a0 ret (10): the routine returns HERE, it
  // does NOT fall into the 0x42a1 gate / slot scan / table copy (the dropped-ret bug the review caught).
  assert.deepEqual(m.pcSeq, [
    0x4006, 0x4228, 0x422a, 0x343e, 0x4230, 0x4232, 0x4234, 0x4290, 0x4292, 0x4293,
    0x4296, 0x4297, 0x4298, 0x429a, 0x429b, 0x429c, 0x429d, 0x429f, 0x42a0,
    CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET, "ret at 0x42a0");
  assert.equal(m.tstates, 191, "cooldown-path T: prefix + jr-z-not-taken(7) + dec(hl)(11) + ret(10)");
  assert.deepEqual(m.calls, [0x4006, 0x343e]);
  assert.equal(m.mem.read8(0x8d5a), 0x02, "(0x8d5a) decremented 0x03 -> 0x02");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_4221 P jr z + jr c -> C0: (0x8d5a)=0 skips dec, (0x8901)<8 -> copy 0x8d5d, clear loop", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0x08, 0x00);
  m.mem.write8(IX + 0x06, 0x07);
  m.mem.write8(0x8d5b, 0x00);
  m.mem.write8(0x8d5a, 0x00);    // zero -> jr z taken -> 0x42a1 (no dec)
  m.mem.write8(0x8901, 0x04);    // < 8 -> jr c taken -> 0x42c0
  m.mem.write8(0x8d5d, 0x2a);

  loc_4221(m);

  assert.equal(m.tstates, 447, "P jr-z jr-c C0 T-state total");
  assert.deepEqual(m.pcSeq, [
    0x4006, 0x4228, 0x422a, 0x343e, 0x4230, 0x4232, 0x4234, 0x4290, 0x4292, 0x4293,
    0x4296, 0x4297, 0x4298, 0x429a, 0x429b, 0x429c, 0x429d, 0x42a1, 0x42a4, 0x42a6, 0x42a9,
    0x42c0, 0x42c3, 0x42c6, 0x42c9, 0x42cd, 0x42cf,
    0x42da, 0x42d5, 0x42d7, 0x42cf, 0x42da, 0x42d5, 0x42d7, 0x42cf, 0x42da, 0x42d5, 0x42d7, 0x42d9,
    CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET, "ret at 0x42d9");
  assert.deepEqual(m.calls, [0x4006, 0x343e, 0x42da, 0x42da, 0x42da]);
  assert.equal(m.mem.read8(0x8d5a), 0x2a, "(0x8d5a) <- (0x8d5d)");
  assert.equal(m.mem.read8(0x8d5b), 0x2a, "(0x8d5b) <- (0x8d5d)");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_4221 P scan found: (0x8901)>=8, first slot (iy+0x04)==7 -> C0", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0x08, 0x00);
  m.mem.write8(IX + 0x06, 0x0a);
  m.mem.write8(0x8d5b, 0x00);
  m.mem.write8(0x8d5a, 0x00);
  m.mem.write8(0x8901, 0x08);    // >= 8 -> scan
  m.mem.write8(0x8d5c, 0x03);    // up to 3 slots
  m.mem.write8(0x8ae0 + 0x04, 0x07); // first slot matches -> jr z -> 0x42c0
  m.mem.write8(0x8d5d, 0x2a);

  loc_4221(m);

  assert.equal(m.tstates, 515, "P scan-found T-state total");
  assert.deepEqual(m.pcSeq, [
    0x4006, 0x4228, 0x422a, 0x343e, 0x4230, 0x4232, 0x4234, 0x4290, 0x4292, 0x4293,
    0x4296, 0x4297, 0x4298, 0x429a, 0x429b, 0x429c, 0x429d, 0x42a1, 0x42a4, 0x42a6, 0x42a9,
    0x42ab, 0x42af, 0x42b2, 0x42b3, 0x42b4,
    0x42b7, 0x42b9, 0x42c0, // scan iter1 -> jr z taken -> C0
    0x42c3, 0x42c6, 0x42c9, 0x42cd, 0x42cf,
    0x42da, 0x42d5, 0x42d7, 0x42cf, 0x42da, 0x42d5, 0x42d7, 0x42cf, 0x42da, 0x42d5, 0x42d7, 0x42d9,
    CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET, "ret at 0x42d9");
  assert.deepEqual(m.calls, [0x4006, 0x343e, 0x42da, 0x42da, 0x42da]);
  assert.equal(m.mem.read8(0x8d5a), 0x2a, "(0x8d5a) <- (0x8d5d)");
  assert.equal(m.regs.iy, 0x8c90, "IY = 0x8c48 + 3*0x18 (blockC9 reseats iy)");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_4221 MUTATION: `bit 0,(ix+0x08)` mis-charged 8T (not 20T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x4228 ? 8 : cycles);
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0x08, 0x00);
  m.mem.write8(IX + 0x06, 0x14);

  loc_4221(m);

  assert.equal(m.tstates, 145, "mutation loses 12 T (20 -> 8)");
  assert.throws(
    () => assert.equal(m.tstates, 157, "T1 T-state total"),
    /157/,
    "the 157-T golden must fail on the mutant",
  );
});
