// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_1ab2 (ROM 0x1ab2-0x1b42, Pooyan) -- record-insert into the sorted
 * 10-entry / 3-byte table at 0x8a00. Scans for the slot where the new record (0x88a2 player 0 /
 * 0x88a5 player 1) is >= the table entry (compared MSB-first from +2); on a slot it shifts three
 * parallel tables with lddr, writes the record, seeds a marker, and paints tiles via rst 0x10
 * (loc_0010). No slot in 10 tries -> plain ret. Self-contained mock: real Regs, flat 64K RAM, real
 * push16/pop16, a POPPING call stub that models the callee's ret (so a missing push16 desyncs SP),
 * and lddrAt mirroring Machine.lddrAt (descending pointers, same 21/16 T and per-iteration flags).
 *
 * Paths:
 *   A  found @ index 0, player 0 (0x880d=0): jr nc taken (no add ix), nz@+2, jr nc found.
 *   B  found @ index 2, player 1 (0x880d=1): add ix, then advance x2 exercising eq@+2/nz@+1 and
 *      nz@+2 compares, found via eq@+2/eq@+1/cp@+0, then the player-1 fork (ix=0x8a33, inc hl).
 *   C  table exhausted (ret z): every entry > new record -> 10 advances, C hits 0, ret with nothing
 *      moved. Exercises the ret-z exit and jr-nc-not-taken x10.
 * Each pins full pcSeq + T-state total + final pc + final sp (balanced to baseline).
 * POSITIVE CONTROL: a wrapped m.step mis-charges the `ld bc,0x001e` step (10 -> 7 T) and the golden
 * total is asserted to fire.
 *
 * Run: node --test games/pooyan/translated/test/loc_1ab2.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1ab2 } from "../loc_1ab2.js";

const CALLER_RET = 0xabcd;
const SP_BASE = 0x8780;

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1ab2, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write16(regs.sp, v); },
    pop16() { const v = mem.read16(regs.sp); regs.sp = (regs.sp + 2) & 0xffff; return v; },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // A popping call so a missing push16 desyncs SP (models the callee doing its own `ret`).
    call(addr) { this.calls.push(addr); this.pc = this.pop16(); return undefined; },
    // Mirrors Machine.lddrAt: LDDR (descending) with the exact per-iteration flag and 21/16 T timing.
    lddrAt(self, nextAddr) {
      for (;;) {
        const byte = mem.read8(regs.hl);
        mem.write8(regs.de, byte);
        regs.hl = (regs.hl - 1) & 0xffff;
        regs.de = (regs.de - 1) & 0xffff;
        regs.bc = (regs.bc - 1) & 0xffff;
        const n = (regs.a + byte) & 0xff;
        regs.f = (regs.f & (0x80 | 0x40 | 0x01)) | (regs.bc !== 0 ? 0x04 : 0) | (n & 0x08 ? 0x08 : 0) | (n & 0x02 ? 0x20 : 0);
        if (regs.bc === 0) { this.step(nextAddr, 16); return; }
        regs.f = (regs.f & ~0x28) | ((self >> 8) & 0x28);
        this.step(self, 21);
      }
    },
  };
}

function seatCaller(m) {
  m.regs.sp = SP_BASE;
  m.push16(CALLER_RET);
}

// ---- independent goldens ------------------------------------------------------------------------

const lddrBlock = (self, next, count) => {
  const a = [];
  for (let i = 0; i < count - 1; i++) a.push(self);
  a.push(next);
  return a;
};
const lddrT = (count) => (count - 1) * 21 + 16;

// scan-loop compare fragments (pcSeq = landing addresses; T from the Z80 timing hints)
const CMP_NZ2 = [0x1acc, 0x1acf, 0x1adf];                                   // nz@+2 -> 1adf
const CMP_NZ2_T = 19 + 19 + 12; // 50
const CMP_NZ1 = [0x1acc, 0x1acf, 0x1ad1, 0x1ad4, 0x1ad7, 0x1adf];          // eq@+2, nz@+1 -> 1adf
const CMP_NZ1_T = 19 + 19 + 7 + 19 + 19 + 12; // 95
const CMP_EQ = [0x1acc, 0x1acf, 0x1ad1, 0x1ad4, 0x1ad7, 0x1ad9, 0x1adc, 0x1adf]; // eq@+2, eq@+1, cp@+0
const CMP_EQ_T = 19 + 19 + 7 + 19 + 19 + 7 + 19 + 19; // 128
const FOUND = [0x1aea];
const FOUND_T = 12;
const ADV = [0x1ae1, 0x1ae3, 0x1ae4, 0x1ae5, 0x1ae6, 0x1ae7, 0x1ae8, 0x1ac9]; // jr nc nt, advance, loop
const ADV_T = 7 + 15 + 4 + 4 + 4 + 4 + 5 + 12; // 55
const EXH = [0x1ae1, 0x1ae3, 0x1ae4, 0x1ae5, 0x1ae6, 0x1ae7, CALLER_RET];      // ret z taken
const EXH_T = 7 + 15 + 4 + 4 + 4 + 4 + 11; // 49

const SETUP_SKIP = [0x1ab5, 0x1ab6, 0x1ab9, 0x1abd, 0x1ac0, 0x1ac1, 0x1ac5, 0x1ac9]; // jr nc taken
const SETUP_SKIP_T = 10 + 4 + 10 + 14 + 13 + 4 + 12 + 14; // 81
const SETUP_ADD = [0x1ab5, 0x1ab6, 0x1ab9, 0x1abd, 0x1ac0, 0x1ac1, 0x1ac3, 0x1ac5, 0x1ac9]; // add ix
const SETUP_ADD_T = 10 + 4 + 10 + 14 + 13 + 4 + 7 + 15 + 14; // 91

function secondHalf(C, player) {
  const head = [
    0x1aeb, 0x1aec, 0x1aef, 0x1af0, 0x1af1, 0x1af4, 0x1af7, ...lddrBlock(0x1af7, 0x1af9, C),
    0x1afa, 0x1afd, 0x1b00, 0x1b03, 0x1b06, 0x1b09, 0x1b0c, 0x1b0d, 0x1b0e, 0x1b12, 0x1b15, 0x1b18, 0x1b19,
  ];
  const headT = 56 + lddrT(C) + 118 + 62; // 236 + lddrT(C)
  const fork = player === 0 ? [0x1b20] : [0x1b1b, 0x1b1f, 0x1b20];
  const forkT = player === 0 ? 12 : 27;
  const tail = [
    0x1b22, 0x1b24, 0x1b27, ...lddrBlock(0x1b27, 0x1b29, C),
    0x1b2c, 0x1b2d, 0x1b2e, 0x1b31, 0x1b32, 0x1b33, 0x1b36, 0x1b39, ...lddrBlock(0x1b39, 0x1b3b, C),
    0x1b3c, 0x1b3d, 0x1b3f, 0x1b41, 0x0010, CALLER_RET,
  ];
  const tailT = 27 + lddrT(C) + 88 + lddrT(C) + 24 + 11 + 10; // 160 + 2*lddrT(C)
  return { seq: [...head, ...fork, ...tail], t: headT + forkT + tailT };
}

// ---- Path A: found @ index 0, player 0 ----------------------------------------------------------

test("loc_1ab2 A: found at index 0, player 0 (0x880d=0)", () => {
  const m = makeMachine();
  seatCaller(m);
  // player 0 record @ 0x88a2, MSB (+2) larger than entry0 -> found on the first compare
  m.mem.write8(0x880d, 0x00);
  m.mem.write8(0x88a2, 0x11);
  m.mem.write8(0x88a3, 0x22);
  m.mem.write8(0x88a4, 0x50); // +2 (MSB)
  m.mem.write8(0x8a00, 0xaa);
  m.mem.write8(0x8a01, 0xbb);
  m.mem.write8(0x8a02, 0x10); // entry0 +2 < 0x50 -> new >= entry -> found
  m.mem.write8(0x89fc, 0xee); // rank sentinel (should be overwritten to 1)

  loc_1ab2(m);

  const half = secondHalf(30, 0); // L=0 -> C=0x1e=30
  assert.deepEqual(m.pcSeq, [...SETUP_SKIP, ...CMP_NZ2, ...FOUND, ...half.seq], "A pcSeq");
  assert.equal(m.tstates, SETUP_SKIP_T + CMP_NZ2_T + FOUND_T + half.t, "A T total"); // 2426
  assert.equal(m.tstates, 2426, "A T literal");
  assert.equal(m.pc, CALLER_RET, "A ret to seated caller");
  assert.equal(m.regs.sp, SP_BASE, "A stack balanced to baseline");
  assert.deepEqual(m.calls, [0x0010], "A: only the page-zero rst 0x10 call");
  assert.equal(m.mem.read8(0x89fc), 0x01, "A rank+1 (index 0 -> 1) at 0x89fc");
  assert.equal(m.mem.read8(0x8a02), 0x50, "A new record MSB written at entry0 +2");
  assert.equal(m.mem.read8(0x89e1), 0x01, "A player-0 marker at 0x89e1");
});

// ---- Path B: found @ index 2, player 1 ----------------------------------------------------------

test("loc_1ab2 B: found at index 2, player 1 (0x880d=1) -- add ix, deep compares", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x880d, 0x01); // bit0 set -> add ix (ix=0x88a5); nonzero -> player-1 fork
  // player 1 record @ 0x88a5
  m.mem.write8(0x88a5, 0x40); // +0
  m.mem.write8(0x88a6, 0x30); // +1
  m.mem.write8(0x88a7, 0x88); // +2 (MSB)
  // entry0 @ 0x8a00: +2 equal, +1 greater -> new < entry -> advance (exercises eq@+2, nz@+1)
  m.mem.write8(0x8a02, 0x88);
  m.mem.write8(0x8a01, 0x50);
  m.mem.write8(0x8a00, 0x00);
  // entry1 @ 0x8a03: +2 greater -> advance (exercises nz@+2)
  m.mem.write8(0x8a05, 0x99);
  // entry2 @ 0x8a06: +2 equal, +1 equal, +0 <= new -> found (exercises eq@+2, eq@+1, cp@+0 nc)
  m.mem.write8(0x8a08, 0x88);
  m.mem.write8(0x8a07, 0x30);
  m.mem.write8(0x8a06, 0x20);
  m.mem.write8(0x89fc, 0xee);

  loc_1ab2(m);

  const half = secondHalf(24, 1); // L=2 -> C=0x18=24
  const expected = [
    ...SETUP_ADD,
    ...CMP_NZ1, ...ADV,   // iter0: eq@+2, nz@+1, advance
    ...CMP_NZ2, ...ADV,   // iter1: nz@+2, advance
    ...CMP_EQ, ...FOUND,  // iter2: eq@+2, eq@+1, cp@+0 -> found
    ...half.seq,
  ];
  assert.deepEqual(m.pcSeq, expected, "B pcSeq");
  assert.equal(
    m.tstates,
    SETUP_ADD_T + (CMP_NZ1_T + ADV_T) + (CMP_NZ2_T + ADV_T) + (CMP_EQ_T + FOUND_T) + half.t,
    "B T total",
  );
  assert.equal(m.tstates, 2406, "B T literal");
  assert.equal(m.pc, CALLER_RET, "B ret to seated caller");
  assert.equal(m.regs.sp, SP_BASE, "B stack balanced to baseline");
  assert.deepEqual(m.calls, [0x0010], "B: only the page-zero rst 0x10 call");
  assert.equal(m.mem.read8(0x89fc), 0x03, "B rank+1 (index 2 -> 3) at 0x89fc");
  assert.equal(m.mem.read8(0x8a06), 0x40, "B new record +0 written at entry2 (0x8a06)");
  assert.equal(m.mem.read8(0x8a08), 0x88, "B new record +2 written at entry2 (0x8a08)");
  assert.equal(m.mem.read8(0x89e2), 0x01, "B player-1 marker at 0x89e2 (inc hl path)");
});

// ---- Path C: table exhausted -> ret z -----------------------------------------------------------

test("loc_1ab2 C: table full -> ret z, nothing moved (0x880d=0)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x880d, 0x00); // player 0 -> jr nc taken, ix=0x88a2
  m.mem.write8(0x88a4, 0x00); // new record MSB = 0 -> below every entry
  for (let i = 0; i < 0x1e; i++) m.mem.write8(0x8a00 + i, 0x80); // every entry MSB 0x80 > 0
  m.mem.write8(0x89fc, 0xee); // must remain untouched (record-write path never runs)

  loc_1ab2(m);

  // 9 full advances (loop back) + a 10th advance that hits C==0 -> ret z
  const iters = [];
  for (let k = 0; k < 9; k++) iters.push(...CMP_NZ2, ...ADV);
  iters.push(...CMP_NZ2, ...EXH);
  assert.deepEqual(m.pcSeq, [...SETUP_SKIP, ...iters], "C pcSeq");
  assert.equal(m.tstates, SETUP_SKIP_T + 9 * (CMP_NZ2_T + ADV_T) + (CMP_NZ2_T + EXH_T), "C T total");
  assert.equal(m.tstates, 1125, "C T literal");
  assert.equal(m.pc, CALLER_RET, "C ret to seated caller");
  assert.equal(m.regs.sp, SP_BASE, "C stack balanced to baseline");
  assert.deepEqual(m.calls, [], "C: no calls (exhausted before the rst 0x10)");
  assert.equal(m.regs.c, 0x00, "C: count decremented to 0 (ret z condition)");
  assert.equal(m.mem.read8(0x89fc), 0xee, "C: rank slot untouched -- record-write path never ran");
});

// ---- POSITIVE CONTROL ---------------------------------------------------------------------------

test("loc_1ab2 MUTATION: `ld bc,0x001e` mis-charged 7T (not 10) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x880d, 0x00);
  m.mem.write8(0x88a4, 0x50);
  m.mem.write8(0x8a02, 0x10);
  const realStep = m.step.bind(m);
  // 0x1ab5 is the landing of `ld bc,0x001e`; mischarge it 10 -> 7.
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x1ab5 ? 7 : cycles);

  loc_1ab2(m);

  assert.equal(m.tstates, 2426 - 3, "mutation loses 3 T (10 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, 2426, "A T literal"),
    /T literal/,
    "the 2426-T golden must fail on the mutant",
  );
});
