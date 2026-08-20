// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_6cab (ROM 0x6cab, Pooyan) -- the aim-indicator / target-acquisition
 * updater. Guards on (0x8806)/(0x8d32); (0x8f24)!=0 clears the flag byte (0x8a87). Else runs loc_6bee,
 * guards on (0x8d54), then: (0x8f30)==1 -> "on target" (loc_6d0d); (0x8f41)!=0 -> re-evaluate lock
 * (loc_6d4d); else scan the 6 sprite blocks at 0x8ae0 (stride 0x18) vs the y-slots at 0x8852.
 *
 * The mock's `call` POPS the return address the call site (or rst 0x10) pushed. loc_6bee is a boundary;
 * the mock models only the pop (A is reloaded from (0x8d54) after the call). Five paths exercise the
 * guards, the clear-and-ret, the (0x8f30)==1 tail, the empty scan loop, and the loc_6d4d/loc_6d60 reset.
 *
 * Run: node --test games/pooyan/translated/test/loc_6cab.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6cab } from "../loc_6cab.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x6cab, pcSeq: [],
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

// Common prefix through `call 0x6bee` up to the (0x8f30) test, ending on the cp 0x01 step (0x6cd1).
const PREFIX_TO_6cd1 = [
  0x6cae, 0x6caf, 0x6cb0, 0x6cb3, 0x6cb4, 0x6cb5, 0x6cb8, 0x6cb9, 0x6cbc, 0x6cc1, 0x6bee,
  0x6cc7, 0x6cc8, 0x6cc9, 0x6ccc, 0x6ccf, 0x6cd1,
];

function passGuards(m) {
  seatCaller(m);
  m.mem.write8(0x8806, 0x00);
  m.mem.write8(0x8d32, 0x00);
  m.mem.write8(0x8f24, 0x00); // -> jr z, run loc_6bee
  m.mem.write8(0x8d54, 0x00); // -> pass the post-call guard
}

test("loc_6cab SIMPLE1: (0x8806)!=0 -> ret nz at 0x6caf", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8806, 0x01);

  loc_6cab(m);

  assert.equal(m.tstates, 13 + 4 + 11);
  assert.deepEqual(m.pcSeq, [0x6cae, 0x6caf, CALLER_RET]);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_6cab SIMPLE3: (0x8f24)!=0 -> clear (0x8a87) + ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8806, 0x00);
  m.mem.write8(0x8d32, 0x00);
  m.mem.write8(0x8f24, 0x01); // non-zero -> jr z not taken -> clear + ret
  m.mem.write8(0x8a87, 0xff); // pre-set so the clear is observable

  loc_6cab(m);

  assert.equal(m.tstates, 99, "SIMPLE3 T-state total");
  assert.deepEqual(m.pcSeq, [
    0x6cae, 0x6caf, 0x6cb0, 0x6cb3, 0x6cb4, 0x6cb5, 0x6cb8, 0x6cb9, 0x6cbc,
    0x6cbe, 0x6cbf, 0x6cc0, CALLER_RET,
  ], "SIMPLE3 step boundaries");
  assert.equal(m.mem.read8(0x8a87), 0x00, "(0x8a87) cleared");
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_6cab MAIN: (0x8f30)==1 -> on-target (0x8a87 bit2=1,bit3=0) via loc_6d0d", () => {
  const m = makeMachine();
  passGuards(m);
  m.mem.write8(0x8f30, 0x01); // -> jr z,0x6d0d
  m.mem.write8(0x8a87, 0x00);

  loc_6cab(m);

  assert.equal(m.tstates, 204, "MAIN T-state total");
  assert.deepEqual(m.pcSeq, [...PREFIX_TO_6cd1, 0x6d0d, 0x6d0f, 0x6d11, CALLER_RET], "MAIN step boundaries");
  assert.equal(m.mem.read8(0x8a87), 0x04, "(0x8a87) bit2 set, bit3 clear");
  assert.deepEqual(m.calls, [0x6bee], "only loc_6bee");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_6cab LOOP: (0x8f30)!=1, (0x8f41)==0 -> empty scan of 6 blocks -> ret z", () => {
  const m = makeMachine();
  passGuards(m);
  m.mem.write8(0x8f30, 0x00); // != 1 -> jr z not taken
  m.mem.write8(0x8f41, 0x00); // 0 -> jp nz not taken -> scan loop; also ret z at 0x6cfd
  // all 6 blocks at 0x8ae0 stride 0x18 have (ix+0)==0 (default) -> every jr nz not taken

  loc_6cab(m);

  const prefix = [
    0x6cae, 0x6caf, 0x6cb0, 0x6cb3, 0x6cb4, 0x6cb5, 0x6cb8, 0x6cb9, 0x6cbc, 0x6cc1, 0x6bee,
    0x6cc7, 0x6cc8, 0x6cc9, 0x6ccc, 0x6ccf, 0x6cd1, 0x6cd3, 0x6cd6, 0x6cd7, 0x6cda, 0x6cdd,
    0x6ce1, 0x6ce5, 0x6ce7,
  ];
  const iter = (last) => [0x6cea, 0x6ceb, 0x6ced, 0x6cf0, 0x6cf2, 0x6cf5, 0x6cf7, last];
  const expected = [
    ...prefix,
    ...iter(0x6ce7), ...iter(0x6ce7), ...iter(0x6ce7), ...iter(0x6ce7), ...iter(0x6ce7),
    ...iter(0x6cf9), // block #6 -> djnz falls out
    0x6cfc, 0x6cfd, CALLER_RET,
  ];
  assert.deepEqual(m.pcSeq, expected, "LOOP full pcSeq (prefix + 6 iters + ret z tail)");
  assert.equal(m.tstates, 812, "LOOP T-state total");
  assert.deepEqual(m.calls, [0x6bee]);
  assert.equal(m.regs.ix, 0x8b70, "IX advanced 6 * 0x18");
  assert.equal(m.regs.iy, 0x886a, "IY advanced 6 * 0x04");
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_6cab 6D4D: (0x8f41)!=0 -> re-evaluate lock; target invalid -> reset via loc_6d60", () => {
  const m = makeMachine();
  passGuards(m);
  m.mem.write8(0x8f30, 0x00); // != 1
  m.mem.write8(0x8f41, 0x01); // != 0 -> jp nz,0x6d4d
  m.mem.write8(0x8f43, 0x00); // ptr low  -> (0x8f43) = 0x9000
  m.mem.write8(0x8f44, 0x90); // ptr high
  m.mem.write8(0x9000, 0x01); // *(ptr) != 0 -> jr nz,0x6d60 (reset path)

  loc_6cab(m);

  assert.equal(m.tstates, 267, "6D4D T-state total");
  assert.deepEqual(m.pcSeq, [
    ...PREFIX_TO_6cd1, 0x6cd3, 0x6cd6, 0x6cd7, 0x6d4d, 0x6d50, 0x6d51, 0x6d52,
    0x6d60, 0x6d61, 0x6d64, 0x6d66, 0x0010, CALLER_RET,
  ], "6D4D step boundaries");
  assert.deepEqual(m.calls, [0x6bee, 0x0010], "loc_6bee + rst 0x10 fill");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780, "stack unwound (call + rst both balanced)");
});

// Covers the 0x6d17 store-path + the `cp c` at 0x6d2d (reached when a block is active, in-band, and a
// lock (0x8f40) already exists -- in-game via a prior block in the same scan; here pre-set for a 1-block
// case). Block 0 active + in-band with (0x8f40)=0x40 > new delta 0x30 -> cp c NC -> "not closer" skip.
function setupCpC(m) {
  passGuards(m);
  m.mem.write8(0x8f30, 0x00);  // != 1 -> scan path
  m.mem.write8(0x8f41, 0x00);  // 0 -> jp nz not taken -> scan; ret z after (no store on the skip branch)
  m.mem.write8(0x8f40, 0x40);  // existing lock distance -> (0x6d2b) and-a NZ -> jr z not taken -> cp c
  m.mem.write8(0x8842, 0x50);  // reference y for `sub (hl)`
  m.mem.write8(0x8ae0, 0x01);  // block 0 active (ix+0)
  m.mem.write8(0x8852, 0x80);  // block 0 y-slot: 0x40 <= 0x80 < 0xc0 (in band); delta = |0x80-0x50| = 0x30
  // blocks 1..5 inactive (default 0)
}

const CPC_PCSEQ = (() => {
  const prefix = [
    0x6cae, 0x6caf, 0x6cb0, 0x6cb3, 0x6cb4, 0x6cb5, 0x6cb8, 0x6cb9, 0x6cbc, 0x6cc1, 0x6bee,
    0x6cc7, 0x6cc8, 0x6cc9, 0x6ccc, 0x6ccf, 0x6cd1, 0x6cd3, 0x6cd6, 0x6cd7, 0x6cda, 0x6cdd,
    0x6ce1, 0x6ce5, 0x6ce7,
  ];
  const block0 = [
    0x6cea, 0x6ceb, 0x6d17, 0x6d1a, 0x6d1c, 0x6d1e, 0x6d20, 0x6d22, 0x6d23, 0x6d26, 0x6d27,
    0x6d2a, 0x6d2b, 0x6d2d, 0x6d2e, 0x6ced, 0x6cf0, 0x6cf2, 0x6cf5, 0x6cf7, 0x6ce7,
  ];
  const inactive = (last) => [0x6cea, 0x6ceb, 0x6ced, 0x6cf0, 0x6cf2, 0x6cf5, 0x6cf7, last];
  return [
    ...prefix, ...block0,
    ...inactive(0x6ce7), ...inactive(0x6ce7), ...inactive(0x6ce7), ...inactive(0x6ce7),
    ...inactive(0x6cf9),
    0x6cfc, 0x6cfd, CALLER_RET,
  ];
})();

test("loc_6cab CP-C: active in-band block with an existing lock reaches `cp c` (0x6d2d), skips, ret z", () => {
  const m = makeMachine();
  setupCpC(m);

  loc_6cab(m);

  assert.deepEqual(m.pcSeq, CPC_PCSEQ, "reaches the 0x6d17 store-path incl. the cp c at 0x6d2d/0x6d2e");
  assert.equal(m.tstates, 927, "CP-C T-state total (cp c charged 4T)");
  assert.deepEqual(m.calls, [0x6bee], "only loc_6bee");
  assert.equal(m.mem.read8(0x8f40), 0x40, "not closer -> lock unchanged");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_6cab CP-C MUTATION: `cp c` (0x6d2d) mis-charged 7T (not 4T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x6d2e ? 7 : cycles);
  setupCpC(m);

  loc_6cab(m);

  assert.equal(m.tstates, 930, "the old 7T typo adds 3 T");
  assert.throws(() => assert.equal(m.tstates, 927), /927/, "the 927-T golden must fail on the mutant");
});

test("loc_6cab MUTATION: `call 0x6bee` mis-charged 10T (not 17T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x6bee ? 10 : cycles);
  passGuards(m);
  m.mem.write8(0x8f30, 0x01);
  m.mem.write8(0x8a87, 0x00);

  loc_6cab(m);

  assert.equal(m.tstates, 197, "mutation loses 7 T (17 -> 10)");
  assert.throws(
    () => assert.equal(m.tstates, 204, "MAIN T-state total"),
    /204/,
    "the 204-T golden must fail on the mutant",
  );
});
