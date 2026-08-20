// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_61b4 (ROM 0x61b4-0x6286, Pooyan) -- the actor-collision handler.
 * Saves HL/IY/BC, scans the 0x8ae0 actor table (5 slots, stride 0x18) for (+0x14)==id, dispatches on
 * the matched slot's (+0x16) high nibble, and on the 0x40/default path does a proximity check and
 * awards points, flagging the slot and zero-filling a sprite buffer before a `pop af; ret` skip-return.
 *
 * The mock `call` POPS the return address the call site pushed (modelling the callee's `ret`); a
 * missing push16 then desyncs SP and fails the skip-return test's final PC/SP. It models loc_0020's
 * net effect (HL += A; A = mem[HL]) and loc_0010's (fill B bytes at HL with A) so the two rst dispatches
 * and the memset are deterministic; the other callees (0x381e/0x0ef1) only pop -- their register
 * results are overwritten before use. Tail `jp` sites (0x6080/0x6287/0x630f/0x60f2) push NOTHING; their
 * callee `ret` consumes the seated CALLER_RET, so an erroneous push16 there fails the sp===0x877e tooth.
 *
 * Two return addresses are seated: CALLER_RET (0x607d's caller's return, consumed by a tail callee's
 * ret OR by the skip-return's `pop af`) over GRANDCALLER_RET (the skip-return target).
 *
 * Run: node --test games/pooyan/translated/test/loc_61b4.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_61b4 } from "../loc_61b4.js";

const CALLER_RET = 0xabcd;
const GRANDCALLER_RET = 0x1234;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x61b4, pcSeq: [],
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
      this.pop16(); // model the callee's `ret` consuming the pushed/seated return
      if (addr === 0x0020) {              // loc_0020: HL += A (16-bit), then A = mem[HL]
        const nh = (regs.hl + regs.a) & 0xffff;
        regs.hl = nh;
        regs.a = mem.read8(nh);
      } else if (addr === 0x0010) {        // loc_0010: fill B bytes at (HL) with A, HL += B, B = 0
        let b = regs.b;
        while (b-- > 0) { mem.write8(regs.hl, regs.a); regs.hl = (regs.hl + 1) & 0xffff; }
        regs.b = 0;
      }
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(GRANDCALLER_RET); // deeper -- the skip-return target
  m.push16(CALLER_RET);      // top -- consumed by a tail callee ret, or by the skip-return `pop af`
}

// ---- pcSeq segments (each address is the ROM `next-instruction` boundary m.step records) ----
const SETUP = [0x61b5, 0x61b7, 0x61b8, 0x61b9, 0x61bb, 0x61bc, 0x61bd, 0x61c1, 0x61c4, 0x61c6];
const L1_ITER = [0x61c9, 0x61cb, 0x61cd, 0x61ce, 0x61c6];       // no-match, jr nz back to 0x61c6
const L1_EXHAUST = [0x61c9, 0x61cb, 0x61cd, 0x61ce, 0x61d0];    // last iter, jr nz falls to path A
const L1_MATCH_BUSY = [0x61c9, 0x61d7, 0x61da, 0x61db, 0x61d0]; // match, (+0x0b)!=0 -> path A
const L1_MATCH_DISPATCH = [0x61c9, 0x61d7, 0x61da, 0x61db, 0x61dd, 0x61e0]; // match, (+0x0b)==0
const PATHA_TAIL = [0x61d1, 0x61d3, 0x61d4, 0x6080];
const DISP_POP = [0x61e1, 0x61e3, 0x61e4, 0x61e6];             // pop bc/iy/hl, and 0xf0
const COLLISION_HIT = [
  0x61fe, 0x6201, 0x6202, 0x6206, 0x6209, 0x620a, 0x620b, 0x620e, 0x6210, 0x6211,
  0x6214, 0x6215, 0x6219, 0x621b, 0x621e, 0x6221, 0x6223, 0x6224, 0x6228, 0x622a, 0x622d,
];
const AWARD_PRE = [
  0x622e, 0x6230, 0x6233, 0x381e, 0x6239, 0x623c, 0x623e, 0x623f, 0x0020, 0x6241,
  0x6244, 0x6245, 0x6248, 0x624c, 0x624f, 0x6251, 0x6254,
];
const LOOP2_ITER = [0x6257, 0x6259, 0x625b, 0x625c, 0x6254];   // no-match, jr nz back to 0x6254
const LOOP2_MATCH = [0x6257, 0x625e];
const POST_I0 = [
  0x6261, 0x6264, 0x6266, 0x6267, 0x0020, 0x6269, 0x626c, 0x626d, 0x6270, 0x6274,
  0x6277, 0x6279, 0x627e, 0x6280, 0x6281, 0x0010, 0x0ef1, 0x6286, GRANDCALLER_RET,
];
const POST_I1 = [
  0x6261, 0x6264, 0x6266, 0x6267, 0x0020, 0x6269, 0x626c, 0x626d, 0x6270, 0x6274,
  0x6277, 0x6279, 0x627b, 0x627e, 0x6280, 0x6281, 0x0010, 0x0ef1, 0x6286, GRANDCALLER_RET,
];
const CALLS_HIT = [0x381e, 0x0020, 0x0020, 0x0010, 0x0ef1];

// seed a matched actor slot at `slot`, id 0x77, not busy, dispatch value `disp`
function seedSlot(m, slot, disp) {
  m.mem.write8(slot + 0x14, 0x77); // id -> match
  m.mem.write8(slot + 0x0b, 0x00); // not busy
  m.mem.write8(slot + 0x16, disp); // dispatch byte
}
// The collision block runs AFTER pop iy/pop ix, so it reads the caller's ORIGINAL IX/IY (two actors
// the caller passed), while loop1/loop2/award use the routine's own iy=0x8ae0+match. Caller object at
// HL=0x8b80 (becomes IX after pop ix -> award), caller actor A at IX=0x8bc0, actor B at IY=0x8bd0.
function seedCaller(m) {
  m.regs.hl = 0x8b80;
  m.regs.ix = 0x8bc0;
  m.regs.iy = 0x8bd0;
  m.mem.write8(0x8b94, 0x77); // (HL+0x14) id read into A at entry
  m.mem.write8(0x8b8a, 0x10); // (object+0x0a) award dest (ix=0x8b80 after pop ix)
}
// geometry for a HIT: dx=2 (actorB.x 0x58 - (actorA.x 0x50 + 6)), dy=4 ((actorB.y 0x34 + 8) - (actorA.y 0x30 + 8))
function seedHitGeometry(m, slot) {
  m.mem.write8(0x881f, 0x01);      // nonzero -> E stays 0x06
  m.mem.write8(0x8bc0, 0x50);      // (ix+0) actor A X
  m.mem.write8(0x8bc2, 0x30);      // (ix+2) actor A Y
  m.mem.write8(0x8bd0, 0x58);      // (iy+0) actor B X -> dx = 0x58-0x56 = 2
  m.mem.write8(0x8bd2, 0x34);      // (iy+2) actor B Y -> dy = 0x3c-0x38 = 4
  m.mem.write8(slot + 0x0a, 0x20); // (iy+0x0a) re-matched slot award dest
  m.mem.write8(0x8907, 0x00);      // rst-0x20 index 0
  m.mem.write8(0x6358, 0x02);      // rst-0x20 table[0] = +0x02 award
}

test("loc_61b4 Path NO-MATCH: 5-slot scan misses -> tail jp 0x6080", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = 0x8b80;
  m.mem.write8(0x8b94, 0xaa); // id with no matching slot (+0x14 all default 0)

  loc_61b4(m);

  assert.deepEqual(m.pcSeq, [...SETUP, ...L1_ITER, ...L1_ITER, ...L1_ITER, ...L1_ITER, ...L1_EXHAUST, ...PATHA_TAIL]);
  assert.equal(m.tstates, 414, "NO-MATCH T total");
  assert.equal(m.pc, 0x6080, "tail jp 0x6080");
  assert.deepEqual(m.calls, [0x6080]);
  assert.equal(m.regs.sp, 0x877e, "seated CALLER_RET consumed by 0x6080's ret");
});

test("loc_61b4 Path BUSY: match but (+0x0b)!=0 -> tail jp 0x6080", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = 0x8b80;
  m.mem.write8(0x8b94, 0x33);
  m.mem.write8(0x8af4, 0x33); // slot0 +0x14 matches
  m.mem.write8(0x8aeb, 0x01); // slot0 +0x0b busy

  loc_61b4(m);

  assert.deepEqual(m.pcSeq, [...SETUP, ...L1_MATCH_BUSY, ...PATHA_TAIL]);
  assert.equal(m.tstates, 200, "BUSY T total");
  assert.equal(m.pc, 0x6080);
  assert.deepEqual(m.calls, [0x6080]);
  assert.equal(m.regs.sp, 0x877e);
});

test("loc_61b4 dispatch nibble 0 -> tail jp 0x6080", () => {
  const m = makeMachine();
  seatCaller(m);
  seedCaller(m);
  seedSlot(m, 0x8ae0, 0x0f); // and 0xf0 -> 0

  loc_61b4(m);

  assert.deepEqual(m.pcSeq, [...SETUP, ...L1_MATCH_DISPATCH, ...DISP_POP, 0x6080]);
  assert.equal(m.tstates, 221);
  assert.equal(m.pc, 0x6080);
  assert.deepEqual(m.calls, [0x6080]);
  assert.equal(m.regs.sp, 0x877e);
});

test("loc_61b4 dispatch nibble 0x50 -> tail jp 0x6287 (BOUNDARY)", () => {
  const m = makeMachine();
  seatCaller(m);
  seedCaller(m);
  seedSlot(m, 0x8ae0, 0x50);

  loc_61b4(m);

  assert.deepEqual(m.pcSeq, [...SETUP, ...L1_MATCH_DISPATCH, ...DISP_POP, 0x61e9, 0x61eb, 0x61ed, 0x61ef, 0x6287]);
  assert.equal(m.tstates, 252);
  assert.equal(m.pc, 0x6287);
  assert.deepEqual(m.calls, [0x6287]);
  assert.equal(m.regs.sp, 0x877e);
});

test("loc_61b4 dispatch nibble 0xf0 -> tail jp 0x630f (BOUNDARY)", () => {
  const m = makeMachine();
  seatCaller(m);
  seedCaller(m);
  seedSlot(m, 0x8ae0, 0xf0);

  loc_61b4(m);

  assert.deepEqual(m.pcSeq, [...SETUP, ...L1_MATCH_DISPATCH, ...DISP_POP, 0x61e9, 0x61eb, 0x61ed, 0x61ef, 0x61f2, 0x61f4, 0x630f]);
  assert.equal(m.tstates, 269);
  assert.equal(m.pc, 0x630f);
  assert.deepEqual(m.calls, [0x630f]);
  assert.equal(m.regs.sp, 0x877e);
});

test("loc_61b4 dispatch nibble 0xd0 -> tail jp 0x6287 (second cp, BOUNDARY)", () => {
  const m = makeMachine();
  seatCaller(m);
  seedCaller(m);
  seedSlot(m, 0x8ae0, 0xd0);

  loc_61b4(m);

  assert.deepEqual(m.pcSeq, [...SETUP, ...L1_MATCH_DISPATCH, ...DISP_POP,
    0x61e9, 0x61eb, 0x61ed, 0x61ef, 0x61f2, 0x61f4, 0x61f7, 0x61f9, 0x6287]);
  assert.equal(m.tstates, 286);
  assert.equal(m.pc, 0x6287);
  assert.deepEqual(m.calls, [0x6287]);
  assert.equal(m.regs.sp, 0x877e);
});

test("loc_61b4 fall-through nibble 0x60 + |dx|>=9 reject (E=0xfe, dx neg) -> tail 0x60f2", () => {
  const m = makeMachine();
  seatCaller(m);
  seedCaller(m);
  seedSlot(m, 0x8ae0, 0x60); // and 0xf0=0x60, no cp match -> fall to 0x61fc
  m.mem.write8(0x881f, 0x00); // zero -> E=0xfe branch
  m.mem.write8(0x8bc0, 0x10); // (ix+0) -> E = 0x10+0xfe = 0x0e
  m.mem.write8(0x8bc2, 0x00); // (ix+2)
  m.mem.write8(0x8bd0, 0x00); // (iy+0)=0 -> dx = 0 - 0x0e -> borrow -> neg -> 0x0e >= 9

  loc_61b4(m);

  const DISP_FALL = [0x61e9, 0x61eb, 0x61ed, 0x61ef, 0x61f2, 0x61f4, 0x61f7, 0x61f9, 0x61fc];
  const COLL_DX = [0x61fe, 0x6201, 0x6202, 0x6204, 0x6206, 0x6209, 0x620a, 0x620b, 0x620e, 0x6210,
    0x6211, 0x6214, 0x6215, 0x6217, 0x6219, 0x621b, 0x60f2];
  assert.deepEqual(m.pcSeq, [...SETUP, ...L1_MATCH_DISPATCH, ...DISP_POP, ...DISP_FALL, ...COLL_DX]);
  assert.equal(m.tstates, 436);
  assert.equal(m.pc, 0x60f2);
  assert.deepEqual(m.calls, [0x60f2]);
  assert.equal(m.regs.sp, 0x877e);
});

test("loc_61b4 jr-z entry (nibble 0x40) + |dy|>=8 reject (dy neg) -> tail 0x60f2", () => {
  const m = makeMachine();
  seatCaller(m);
  seedCaller(m);
  seedSlot(m, 0x8ae0, 0x40);
  m.mem.write8(0x881f, 0x01); // E=0x06
  m.mem.write8(0x8bc0, 0x50);
  m.mem.write8(0x8bc2, 0x30);
  m.mem.write8(0x8bd0, 0x58); // (iy+0) -> dx = 0x58-0x56 = 2 (ok, no neg)
  m.mem.write8(0x8bd2, 0x00); // (iy+2)=0 -> dy = (0+8) - (0x30+8) = 0x08-0x38 -> borrow -> neg -> 0x30 >= 8

  loc_61b4(m);

  const DISP_JRZ = [0x61e9, 0x61eb, 0x61fc];
  const COLL_DY = [0x61fe, 0x6201, 0x6202, 0x6206, 0x6209, 0x620a, 0x620b, 0x620e, 0x6210, 0x6211,
    0x6214, 0x6215, 0x6219, 0x621b, 0x621e, 0x6221, 0x6223, 0x6224, 0x6226, 0x6228, 0x622a, 0x60f2];
  assert.deepEqual(m.pcSeq, [...SETUP, ...L1_MATCH_DISPATCH, ...DISP_POP, ...DISP_JRZ, ...COLL_DY]);
  assert.equal(m.tstates, 447);
  assert.equal(m.pc, 0x60f2);
  assert.deepEqual(m.calls, [0x60f2]);
  assert.equal(m.regs.sp, 0x877e);
});

test("loc_61b4 HIT slot0, I==0: award + memset 0x8c90 + skip-return to grandcaller", () => {
  const m = makeMachine();
  seatCaller(m);
  seedCaller(m);
  seedSlot(m, 0x8ae0, 0x40);
  seedHitGeometry(m, 0x8ae0);
  m.regs.i = 0x00; // ld a,i -> Z -> HL stays 0x8c90

  loc_61b4(m);

  const DISP_JRZ = [0x61e9, 0x61eb, 0x61fc];
  assert.deepEqual(m.pcSeq, [
    ...SETUP, ...L1_MATCH_DISPATCH, ...DISP_POP, ...DISP_JRZ,
    ...COLLISION_HIT, ...AWARD_PRE, ...LOOP2_MATCH, ...POST_I0,
  ]);
  assert.equal(m.tstates, 872, "HIT slot0 T total");
  assert.equal(m.pc, GRANDCALLER_RET, "skip-return (pop af dropped CALLER_RET, ret to grandcaller)");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
  assert.deepEqual(m.calls, CALLS_HIT);
  assert.equal(m.mem.read8(0x8b8a), 0x12, "(ix+0x0a) awarded +0x02");
  assert.equal(m.mem.read8(0x8aea), 0x22, "(iy+0x0a) awarded +0x02");
  assert.equal(m.mem.read8(0x8af6), 0x50, "slot (+0x16) bit4 set (0x40 -> 0x50)");
  assert.equal(m.mem.read8(0x8c90), 0x00, "sprite buffer 0x8c90 zero-filled");
  assert.equal(m.mem.read8(0x8ca7), 0x00, "sprite buffer end (0x8c90+0x17) zero-filled");
});

test("loc_61b4 HIT slot2, I!=0: loop1/loop2 iterate, buffer 0x8ca8, skip-return", () => {
  const m = makeMachine();
  seatCaller(m);
  seedCaller(m);
  const SLOT2 = 0x8b10;
  m.mem.write8(0x8af4, 0x11); // slot0 +0x14 -> no match
  m.mem.write8(0x8b0c, 0x22); // slot1 +0x14 -> no match
  seedSlot(m, SLOT2, 0x40);   // slot2 matches, dispatch 0x40
  seedHitGeometry(m, SLOT2);
  m.regs.i = 0x08; // ld a,i -> not Z -> HL = 0x8ca8

  loc_61b4(m);

  const DISP_JRZ = [0x61e9, 0x61eb, 0x61fc];
  assert.deepEqual(m.pcSeq, [
    ...SETUP, ...L1_ITER, ...L1_ITER, ...L1_MATCH_DISPATCH, ...DISP_POP, ...DISP_JRZ,
    ...COLLISION_HIT, ...AWARD_PRE, ...LOOP2_ITER, ...LOOP2_ITER, ...LOOP2_MATCH, ...POST_I1,
  ]);
  assert.equal(m.tstates, 1105, "HIT slot2 T total");
  assert.equal(m.pc, GRANDCALLER_RET);
  assert.equal(m.regs.sp, 0x8780);
  assert.deepEqual(m.calls, CALLS_HIT);
  assert.equal(m.mem.read8(0x8b8a), 0x12, "(ix+0x0a) awarded");
  assert.equal(m.mem.read8(SLOT2 + 0x0a), 0x22, "(iy+0x0a) awarded on slot2");
  assert.equal(m.mem.read8(SLOT2 + 0x16), 0x50, "slot2 (+0x16) bit4 set");
  assert.equal(m.mem.read8(0x8ca8), 0x00, "sprite buffer 0x8ca8 zero-filled (I!=0)");
});

test("loc_61b4 MUTATION: `set 4,(iy+0x16)` mis-charged 7T (not 23T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x6274 ? 7 : cycles);
  seatCaller(m);
  seedCaller(m);
  seedSlot(m, 0x8ae0, 0x40);
  seedHitGeometry(m, 0x8ae0);
  m.regs.i = 0x00;

  loc_61b4(m);

  assert.equal(m.tstates, 856, "mutation loses 16 T (23 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, 872, "HIT slot0 T total"),
    /872/,
    "the 872-T golden must fail on the mutant",
  );
});
