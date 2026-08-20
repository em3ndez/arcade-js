// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_638a (ROM 0x638a, Pooyan) -- the per-slot proximity scan that
 * inlines its 0x63ef back-edge. For B slots it tests the actor at IY against the slot (empty slots
 * skipped, slot X offset +5/-2 per 0x881f, |dx|<6 AND |dy|<6). A hit claims the slot (IX=HL), writes
 * state bytes, sets the animation (0x381e), flags 0x8d1b/0x8d1c per I, queues (0x0ef9 + rst 0x38),
 * then SKIP-RETURNS: `pop af` drops the immediate return, `ret` goes one level up.
 *
 * The mock's `call` POPS the return the call site pushed (models each callee's ret). The collision
 * path frames push hl / pop ix and three calls, all balanced, so at `pop af` the stack is back to the
 * two seated words: pop af drops IMM_RET, ret lands on GRAND_RET, sp returns to baseline. A missing
 * push16 at any call site desyncs those pops and fails the pc/sp teeth.
 *
 * Paths: HIT (E=5, dx/dy near, I==0 -> 0x8d1b); EMPTY (two empty slots -> advance/djnz, ret at 0x63fa);
 * XFAR (0x881f==0 -> E=0xfe, dx negated then >=6 -> advance); YFAR (dy negated then >=6 -> advance);
 * HIT_I (I!=0 -> 0x8d1c). Plus a T-state mutation tooth.
 *
 * Run: node --test games/pooyan/translated/test/loc_638a.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_638a } from "../loc_638a.js";

const CALLER_RET = 0xabcd;
const IMM_RET = 0x1111;   // immediate return -- the skip-return drops this into AF
const GRAND_RET = 0x2222; // one level up -- where the skip-return actually lands

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x638a, pcSeq: [],
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
    // Each callee's `ret` pops the return the call site pushed; model that pop so a missing push16
    // desyncs the stack. loc_638a reads nothing the callees leave in registers/RAM afterward.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

// Single-return seat (paths that end with a normal ret at 0x63fa).
function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

// Two-word seat for the skip-return: GRAND_RET below, IMM_RET on top.
function seatSkip(m) {
  m.regs.sp = 0x8780;
  m.push16(GRAND_RET);
  m.push16(IMM_RET);
}

// Shared HIT geometry: slot (IX=0x9000) X=0x10 Y=0x20, actor (IY=0x9100) X=0x18 Y=0x22, slot list at
// HL=0x9200 occupied. E=5: dx = 0x18-(0x10+5)=3 (<6), dy = (0x22+8)-(0x20+8)=2 (<6) -> collision.
function setupHit(m) {
  m.regs.ix = 0x9000;
  m.regs.iy = 0x9100;
  m.regs.hl = 0x9200;
  m.regs.b = 0x01;
  m.mem.write8(0x9200, 0x05); // slot occupied
  m.mem.write8(0x881f, 0x01); // gate != 0 -> E = 5
  m.mem.write8(0x9000, 0x10); // slot X
  m.mem.write8(0x9002, 0x20); // slot Y
  m.mem.write8(0x9100, 0x18); // actor X
  m.mem.write8(0x9102, 0x22); // actor Y
}

const PC_HIT_COMMON = [
  0x638b, 0x638c, 0x638e, 0x6390, 0x6393, 0x6394, 0x6398, 0x639b, 0x639c, 0x639d,
  0x63a0, 0x63a2, 0x63a3, 0x63a6, 0x63a7, 0x63ab, 0x63ad, 0x63af, 0x63b2, 0x63b4,
  0x63b5, 0x63b9, 0x63bb, 0x63bd, 0x63be, 0x63c0, 0x63c4, 0x63c8, 0x63cc, 0x63d0,
  0x63d3, 0x63d6, 0x63d8, 0x63d9,
];
const PC_HIT_TAIL = [
  0x63e0, 0x63e3, 0x381e, 0x0ef9, 0x63ec, 0x0038, 0x63ee, GRAND_RET,
];

function assertHitWrites(m) {
  assert.equal(m.regs.ix, 0x9200, "IX = HL (claimed slot)");
  assert.equal(m.mem.read8(0x9200), 0x00, "slot byte 0 = 0");
  assert.equal(m.mem.read8(0x9201), 0x01, "slot byte 1 = 1");
  assert.equal(m.mem.read8(0x9202), 0x02, "slot byte 2 = 2");
  assert.equal(m.mem.read8(0x9211), 0x28, "slot byte 0x11 = 0x28");
  assert.equal(m.regs.de, 0x0315, "DE = display cmd id for the rst 0x38");
  assert.deepEqual(m.calls, [0x381e, 0x0ef9, 0x0038], "set-anim, queue-tile, enqueue-cmd");
  assert.equal(m.pc, GRAND_RET, "skip-return lands one level up");
  assert.equal(m.regs.sp, 0x8780, "stack unwound: pop af dropped IMM_RET, ret took GRAND_RET");
}

test("loc_638a HIT: proximity match, I==0 -> flag 0x8d1b, skip-return", () => {
  const m = makeMachine();
  seatSkip(m);
  setupHit(m);
  m.regs.i = 0x00; // I==0 -> jr z taken -> HL stays 0x8d1b

  loc_638a(m);

  assert.equal(m.tstates, 457, "HIT (I==0) T-state total");
  assert.deepEqual(m.pcSeq, [...PC_HIT_COMMON, 0x63de, ...PC_HIT_TAIL], "jr z taken keeps 0x8d1b");
  assert.equal(m.mem.read8(0x8d1b), 0x01, "0x8d1b flag set");
  assert.equal(m.mem.read8(0x8d1c), 0x00, "0x8d1c untouched");
  assertHitWrites(m);
});

test("loc_638a HIT_I: proximity match, I!=0 -> flag 0x8d1c, skip-return", () => {
  const m = makeMachine();
  seatSkip(m);
  setupHit(m);
  m.regs.i = 0x01; // I!=0 -> jr z not taken -> HL = 0x8d1c

  loc_638a(m);

  assert.equal(m.tstates, 462, "HIT (I!=0) adds the ld hl,0x8d1c (7+10 vs 12)");
  assert.deepEqual(m.pcSeq, [...PC_HIT_COMMON, 0x63db, 0x63de, ...PC_HIT_TAIL], "jr z not taken -> 0x8d1c");
  assert.equal(m.mem.read8(0x8d1c), 0x01, "0x8d1c flag set");
  assert.equal(m.mem.read8(0x8d1b), 0x00, "0x8d1b untouched");
  assertHitWrites(m);
});

test("loc_638a EMPTY: two empty slots -> advance + djnz, ret at 0x63fa", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.regs.iy = 0x9100;
  m.regs.hl = 0x9200;
  m.regs.b = 0x02;
  // mem[0x9200] and mem[0x9218] default 0 -> both empty

  loc_638a(m);

  assert.equal(m.tstates, 169, "two empty passes (82 + 87)");
  assert.deepEqual(m.pcSeq, [
    0x638b, 0x638c, 0x63ef, 0x63f2, 0x63f4, 0x63f7, 0x63f8, 0x638a, // pass 1: empty -> advance, djnz taken
    0x638b, 0x638c, 0x63ef, 0x63f2, 0x63f4, 0x63f7, 0x63f8, 0x63fa, // pass 2: empty -> advance, djnz falls out
    CALLER_RET,
  ], "empty slots advance then djnz");
  assert.equal(m.pc, CALLER_RET, "ret at 0x63fa to the seated caller");
  assert.equal(m.regs.ix, 0x9008, "IX advanced twice (+4 each)");
  assert.equal(m.regs.hl, 0x9230, "HL advanced twice (+0x18 each)");
  assert.equal(m.regs.b, 0x00, "B counted down to 0");
  assert.deepEqual(m.calls, [], "no spawn on empty slots");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_638a XFAR: gate 0 -> E=0xfe, dx negated and >=6 -> advance", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.regs.iy = 0x9100;
  m.regs.hl = 0x9200;
  m.regs.b = 0x01;
  m.mem.write8(0x9200, 0x05); // occupied
  m.mem.write8(0x881f, 0x00); // gate 0 -> jr nz not taken -> E = 0xfe
  m.mem.write8(0x9000, 0x10); // E = 0x10 + 0xfe = 0x0e
  m.mem.write8(0x9002, 0x20);
  m.mem.write8(0x9100, 0x05); // dx = 0x05 - 0x0e -> borrow -> neg -> 0x09 (>=6) -> advance

  loc_638a(m);

  assert.equal(m.tstates, 234, "XFAR T-state total");
  assert.deepEqual(m.pcSeq, [
    0x638b, 0x638c, 0x638e, 0x6390, 0x6393, 0x6394, 0x6396, 0x6398, 0x639b, 0x639c,
    0x639d, 0x63a0, 0x63a2, 0x63a3, 0x63a6, 0x63a7, 0x63a9, 0x63ab, 0x63ad, 0x63ef,
    0x63f2, 0x63f4, 0x63f7, 0x63f8, 0x63fa, CALLER_RET,
  ], "E=0xfe branch (visits 0x6396), neg on dx, jr nc at 0x63ad advances");
  assert.equal(m.regs.de, 0x0018, "DE last-loaded by the advance");
  assert.equal(m.pc, CALLER_RET, "ret to caller after djnz falls out");
  assert.deepEqual(m.calls, [], "no spawn");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_638a YFAR: dx near but dy negated and >=6 -> advance", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.regs.iy = 0x9100;
  m.regs.hl = 0x9200;
  m.regs.b = 0x01;
  m.mem.write8(0x9200, 0x05); // occupied
  m.mem.write8(0x881f, 0x01); // gate != 0 -> E = 5
  m.mem.write8(0x9000, 0x10); // E = 0x15
  m.mem.write8(0x9002, 0x20); // D = 0x28
  m.mem.write8(0x9100, 0x18); // dx = 0x18 - 0x15 = 3 (<6) -> continue to dy
  m.mem.write8(0x9102, 0x10); // dy = (0x10+8) - 0x28 -> borrow -> neg -> 0x10 (>=6) -> advance

  loc_638a(m);

  assert.equal(m.tstates, 288, "YFAR T-state total");
  assert.deepEqual(m.pcSeq, [
    0x638b, 0x638c, 0x638e, 0x6390, 0x6393, 0x6394, 0x6398, 0x639b, 0x639c, 0x639d,
    0x63a0, 0x63a2, 0x63a3, 0x63a6, 0x63a7, 0x63ab, 0x63ad, 0x63af, 0x63b2, 0x63b4,
    0x63b5, 0x63b7, 0x63b9, 0x63bb, 0x63ef, 0x63f2, 0x63f4, 0x63f7, 0x63f8, 0x63fa,
    CALLER_RET,
  ], "dx passes, neg on dy, jr nc at 0x63bb advances");
  assert.equal(m.pc, CALLER_RET, "ret to caller after djnz falls out");
  assert.deepEqual(m.calls, [], "no spawn");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_638a MUTATION: ld a,(ix+0) mis-charged 7T (not 19T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x639b ? 7 : cycles);
  seatSkip(m);
  setupHit(m);
  m.regs.i = 0x00;

  loc_638a(m);

  assert.equal(m.tstates, 445, "mutation loses 12 T (19 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, 457, "HIT T-state total"),
    /457/,
    "the 457-T golden must fail on the mutant",
  );
});
