// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_5b99 (ROM 0x5b99-0x5c74, Pooyan) -- the proximity/collision check
 * of one actor (IX record) against the 0x8c90 object pair, with hit registration. The cluster's
 * internal labels 0x5bbe (outer scan), 0x5c38 (inner scan), 0x5c46/0x5c48 (skip tails) and 0x5c54
 * (found handler) are inlined into the one routine; 0x5c48 is a mid-block re-entry so it cannot be a
 * separate callable head.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling the callee's `ret`), so a
 * missing push16 desyncs the stack and the SP/pc teeth fail. loc_5b99's two HIT exits do `pop af; ret`,
 * which discards loc_5b99's OWN return and unwinds to the caller's caller -- so the caller frame is
 * seated TWO deep: [GRANDPARENT_RET, CALLER_RET]. Normal-ret paths land on CALLER_RET (sp leaves
 * GRANDPARENT_RET seated); the pop-af;ret paths land on GRANDPARENT_RET (sp fully unwound).
 *
 * Golden pcSeq + T-states come from an independent Python reference (scratchpad/oracle.py) that mirrors
 * the ROM control flow from the disassembly, not from this JS. Every branch is exercised:
 * jr nz@5b9d (both), ret nz@5ba4 (both), ret z@5ba9/5bae, ret nz@5bb4, jp z@5bc2, jr nz@5bc9,
 * jr nz@5bd1 (both), jr nc@5be8 (both, i.e. the X neg), jr nc@5bee, jr nz@5bf9 (both),
 * jr nc@5c10 (both, i.e. the Y neg), jr nc@5c16 (both), jr z@5c1f (both), jr z@5c3e (both),
 * djnz@5c42 (loop + exit), jr z@5c67 (both), jp nz@5c50 (loop + ret).
 *
 * Run: node --test games/pooyan/translated/test/loc_5b99.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5b99 } from "../loc_5b99.js";

const CALLER_RET = 0xabcd;
const GRANDPARENT_RET = 0x9876;
const IX = 0x8ae0;
const IY_OUTER = 0x8c90;
const IY_INNER = 0x8b70;
const SP_SEAT = 0x8780;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x5b99, pcSeq: [],
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
    // The callee's `ret` pops the return address loc_5b99 pushed at the call site. 0x381e/0x0c45/0x5c75
    // preserve the registers loc_5b99 relies on afterward (it reloads iy/de itself before the inner
    // loop, and depends on iy surviving 0x0c45 -- the ROM reads (iy+0x0b) with no reload), so a pure
    // pop is faithful. A missing push16 at a call site then desyncs SP and fails the teeth.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

// Seat the caller frame TWO deep: GRANDPARENT_RET below, CALLER_RET on top.
function seat(m) {
  m.regs.sp = SP_SEAT;
  m.push16(GRANDPARENT_RET);
  m.push16(CALLER_RET);
  m.regs.ix = IX;
}

function passGuards(m) {
  m.mem.write8(IX + 0x0b, 0x01); // armed (jr nz@5b9d taken)
  m.mem.write8(IX + 0x00, 0x01); // active
  m.mem.write8(IX + 0x16, 0x01); // flagged
  m.mem.write8(IX + 0x02, 0x05); // mode 5
}

function alignDx(m) {
  m.mem.write8(IY_OUTER + 0x00, 0x01); // present, not busy
  m.mem.write8(0x881f, 0x00);          // e=0x08
  m.mem.write8(IX + 0x06, 0x00);
  m.mem.write8(IX + 0x05, 0x00);
  m.mem.write8(IY_OUTER + 0x06, 0x08); // X: 0+8-8 = 0 aligned (no neg)
}

const PC_GUARD_ARM = [0x5b9d, 0x5b9f, 0x5ba2, 0x5ba4, CALLER_RET];
const PC_GUARD_ARM_PASS = [0x5b9d, 0x5b9f, 0x5ba2, 0x5ba4, 0x5ba5, 0x5ba9, CALLER_RET];
const PC_GUARD_INACTIVE = [0x5b9d, 0x5ba5, 0x5ba9, CALLER_RET];
const PC_GUARD_FLAG = [0x5b9d, 0x5ba5, 0x5ba9, 0x5baa, 0x5bae, CALLER_RET];
const PC_GUARD_MODE = [0x5b9d, 0x5ba5, 0x5ba9, 0x5baa, 0x5bae, 0x5baf, 0x5bb2, 0x5bb4, CALLER_RET];
const PC_SKIP_ABSENT = [0x5b9d, 0x5ba5, 0x5ba9, 0x5baa, 0x5bae, 0x5baf, 0x5bb2, 0x5bb4, 0x5bb5, 0x5bb8, 0x5bbc, 0x5bbe, 0x5bc2, 0x5c46, 0x5c47, 0x5c48, 0x5c49, 0x5c4a, 0x5c4d, 0x5c4f, 0x5c50, 0x5bbe, 0x5bc2, 0x5c46, 0x5c47, 0x5c48, 0x5c49, 0x5c4a, 0x5c4d, 0x5c4f, 0x5c50, 0x5c53, CALLER_RET];
const PC_SKIP_BUSY = [0x5b9d, 0x5ba5, 0x5ba9, 0x5baa, 0x5bae, 0x5baf, 0x5bb2, 0x5bb4, 0x5bb5, 0x5bb8, 0x5bbc, 0x5bbe, 0x5bc2, 0x5bc5, 0x5bc9, 0x5c46, 0x5c47, 0x5c48, 0x5c49, 0x5c4a, 0x5c4d, 0x5c4f, 0x5c50, 0x5bbe, 0x5bc2, 0x5c46, 0x5c47, 0x5c48, 0x5c49, 0x5c4a, 0x5c4d, 0x5c4f, 0x5c50, 0x5c53, CALLER_RET];
const PC_SKIP_DX = [0x5b9d, 0x5ba5, 0x5ba9, 0x5baa, 0x5bae, 0x5baf, 0x5bb2, 0x5bb4, 0x5bb5, 0x5bb8, 0x5bbc, 0x5bbe, 0x5bc2, 0x5bc5, 0x5bc9, 0x5bcb, 0x5bcd, 0x5bd0, 0x5bd1, 0x5bd5, 0x5bd8, 0x5bdb, 0x5bdd, 0x5bde, 0x5be0, 0x5be1, 0x5be3, 0x5be4, 0x5be5, 0x5be8, 0x5bea, 0x5bec, 0x5bee, 0x5c46, 0x5c47, 0x5c48, 0x5c49, 0x5c4a, 0x5c4d, 0x5c4f, 0x5c50, 0x5bbe, 0x5bc2, 0x5c46, 0x5c47, 0x5c48, 0x5c49, 0x5c4a, 0x5c4d, 0x5c4f, 0x5c50, 0x5c53, CALLER_RET];
const PC_SKIP_DY = [0x5b9d, 0x5ba5, 0x5ba9, 0x5baa, 0x5bae, 0x5baf, 0x5bb2, 0x5bb4, 0x5bb5, 0x5bb8, 0x5bbc, 0x5bbe, 0x5bc2, 0x5bc5, 0x5bc9, 0x5bcb, 0x5bcd, 0x5bd0, 0x5bd1, 0x5bd3, 0x5bd5, 0x5bd8, 0x5bdb, 0x5bdd, 0x5bde, 0x5be0, 0x5be1, 0x5be3, 0x5be4, 0x5be5, 0x5be8, 0x5bec, 0x5bee, 0x5bf0, 0x5bf1, 0x5bf2, 0x5bf4, 0x5bf7, 0x5bf9, 0x5bfd, 0x5c00, 0x5c03, 0x5c05, 0x5c06, 0x5c08, 0x5c09, 0x5c0b, 0x5c0c, 0x5c0d, 0x5c10, 0x5c14, 0x5c16, 0x5c48, 0x5c49, 0x5c4a, 0x5c4d, 0x5c4f, 0x5c50, 0x5bbe, 0x5bc2, 0x5c46, 0x5c47, 0x5c48, 0x5c49, 0x5c4a, 0x5c4d, 0x5c4f, 0x5c50, 0x5c53, CALLER_RET];
const PC_HIT_NOMATCH = [0x5b9d, 0x5ba5, 0x5ba9, 0x5baa, 0x5bae, 0x5baf, 0x5bb2, 0x5bb4, 0x5bb5, 0x5bb8, 0x5bbc, 0x5bbe, 0x5bc2, 0x5bc5, 0x5bc9, 0x5bcb, 0x5bcd, 0x5bd0, 0x5bd1, 0x5bd3, 0x5bd5, 0x5bd8, 0x5bdb, 0x5bdd, 0x5bde, 0x5be0, 0x5be1, 0x5be3, 0x5be4, 0x5be5, 0x5be8, 0x5bec, 0x5bee, 0x5bf0, 0x5bf1, 0x5bf2, 0x5bf4, 0x5bf7, 0x5bf9, 0x5bfb, 0x5bfd, 0x5c00, 0x5c03, 0x5c05, 0x5c06, 0x5c08, 0x5c09, 0x5c0b, 0x5c0c, 0x5c0d, 0x5c10, 0x5c14, 0x5c16, 0x5c18, 0x5c1b, 0x5c1f, 0x5c24, 0x381e, 0x5c2b, 0x5c2f, 0x5c33, 0x5c36, 0x5c38, 0x5c3b, 0x5c3e, 0x5c40, 0x5c42, 0x5c38, 0x5c3b, 0x5c3e, 0x5c40, 0x5c42, 0x5c38, 0x5c3b, 0x5c3e, 0x5c40, 0x5c42, 0x5c38, 0x5c3b, 0x5c3e, 0x5c40, 0x5c42, 0x5c38, 0x5c3b, 0x5c3e, 0x5c40, 0x5c42, 0x5c44, 0x5c45, GRANDPARENT_RET];
const PC_HIT_MATCH = [0x5b9d, 0x5ba5, 0x5ba9, 0x5baa, 0x5bae, 0x5baf, 0x5bb2, 0x5bb4, 0x5bb5, 0x5bb8, 0x5bbc, 0x5bbe, 0x5bc2, 0x5bc5, 0x5bc9, 0x5bcb, 0x5bcd, 0x5bd0, 0x5bd1, 0x5bd3, 0x5bd5, 0x5bd8, 0x5bdb, 0x5bdd, 0x5bde, 0x5be0, 0x5be1, 0x5be3, 0x5be4, 0x5be5, 0x5be8, 0x5bec, 0x5bee, 0x5bf0, 0x5bf1, 0x5bf2, 0x5bf4, 0x5bf7, 0x5bf9, 0x5bfb, 0x5bfd, 0x5c00, 0x5c03, 0x5c05, 0x5c06, 0x5c08, 0x5c09, 0x5c0b, 0x5c0c, 0x5c0d, 0x5c10, 0x5c12, 0x5c14, 0x5c16, 0x5c18, 0x5c1b, 0x5c1f, 0x5c21, 0x5c24, 0x381e, 0x5c2b, 0x5c2f, 0x5c33, 0x5c36, 0x5c38, 0x5c3b, 0x5c3e, 0x5c40, 0x5c42, 0x5c38, 0x5c3b, 0x5c3e, 0x5c54, 0x5c57, 0x5c5a, 0x5c5c, 0x5c5d, 0x5c5e, 0x5c5f, 0x5c60, 0x0c45, 0x5c67, 0x5c69, 0x5c6c, 0x5c70, 0x5c75, 0x5c74, GRANDPARENT_RET];
const PC_HIT_MATCH_B = [0x5b9d, 0x5ba5, 0x5ba9, 0x5baa, 0x5bae, 0x5baf, 0x5bb2, 0x5bb4, 0x5bb5, 0x5bb8, 0x5bbc, 0x5bbe, 0x5bc2, 0x5bc5, 0x5bc9, 0x5bcb, 0x5bcd, 0x5bd0, 0x5bd1, 0x5bd3, 0x5bd5, 0x5bd8, 0x5bdb, 0x5bdd, 0x5bde, 0x5be0, 0x5be1, 0x5be3, 0x5be4, 0x5be5, 0x5be8, 0x5bec, 0x5bee, 0x5bf0, 0x5bf1, 0x5bf2, 0x5bf4, 0x5bf7, 0x5bf9, 0x5bfb, 0x5bfd, 0x5c00, 0x5c03, 0x5c05, 0x5c06, 0x5c08, 0x5c09, 0x5c0b, 0x5c0c, 0x5c0d, 0x5c10, 0x5c14, 0x5c16, 0x5c18, 0x5c1b, 0x5c1f, 0x5c24, 0x381e, 0x5c2b, 0x5c2f, 0x5c33, 0x5c36, 0x5c38, 0x5c3b, 0x5c3e, 0x5c54, 0x5c57, 0x5c5a, 0x5c5c, 0x5c5d, 0x5c5e, 0x5c5f, 0x5c60, 0x0c45, 0x5c67, 0x5c6c, 0x5c70, 0x5c75, 0x5c74, GRANDPARENT_RET];

// --- guard-chain paths (short) ---

test("loc_5b99 GUARD_ARM: not armed + 0x8907 bit0 set -> ret nz at 0x5ba4", () => {
  const m = makeMachine(); seat(m);
  m.mem.write8(IX + 0x0b, 0x00);   // jr nz@5b9d not taken
  m.mem.write8(0x8907, 0x01);      // bit0 set -> ret nz
  loc_5b99(m);
  assert.equal(m.tstates, 59);
  assert.deepEqual(m.pcSeq, PC_GUARD_ARM);
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, SP_SEAT - 2, "normal ret leaves GRANDPARENT_RET seated");
  assert.deepEqual(m.calls, []);
});

test("loc_5b99 GUARD_ARM_PASS: not armed + 0x8907 bit0 clear -> ret nz not taken, ret z at 0x5ba9", () => {
  const m = makeMachine(); seat(m);
  m.mem.write8(IX + 0x0b, 0x00);
  m.mem.write8(0x8907, 0x00);      // ret nz not taken
  m.mem.write8(IX + 0x00, 0x00);   // inactive -> ret z
  loc_5b99(m);
  assert.equal(m.tstates, 84);
  assert.deepEqual(m.pcSeq, PC_GUARD_ARM_PASS);
  assert.equal(m.pc, CALLER_RET);
});

test("loc_5b99 GUARD_INACTIVE: armed but ix+0 clear -> ret z at 0x5ba9", () => {
  const m = makeMachine(); seat(m);
  m.mem.write8(IX + 0x0b, 0x01);   // jr nz@5b9d taken
  m.mem.write8(IX + 0x00, 0x00);
  loc_5b99(m);
  assert.equal(m.tstates, 63);
  assert.deepEqual(m.pcSeq, PC_GUARD_INACTIVE);
  assert.equal(m.pc, CALLER_RET);
});

test("loc_5b99 GUARD_FLAG: ix+0x16 clear -> ret z at 0x5bae", () => {
  const m = makeMachine(); seat(m); passGuards(m);
  m.mem.write8(IX + 0x16, 0x00);
  loc_5b99(m);
  assert.equal(m.tstates, 88);
  assert.deepEqual(m.pcSeq, PC_GUARD_FLAG);
  assert.equal(m.pc, CALLER_RET);
});

test("loc_5b99 GUARD_MODE: ix+2 != 5 -> ret nz at 0x5bb4", () => {
  const m = makeMachine(); seat(m); passGuards(m);
  m.mem.write8(IX + 0x02, 0x03);
  loc_5b99(m);
  assert.equal(m.tstates, 119);
  assert.deepEqual(m.pcSeq, PC_GUARD_MODE);
  assert.equal(m.pc, CALLER_RET);
});

// --- outer-scan skip paths (loop iterates B=2, ends ret at 0x5c53) ---

test("loc_5b99 SKIP_ABSENT: both entries absent -> jp z x2, loop, ret at 0x5c53", () => {
  const m = makeMachine(); seat(m); passGuards(m);
  loc_5b99(m);
  assert.equal(m.tstates, 324);
  assert.deepEqual(m.pcSeq, PC_SKIP_ABSENT);
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, SP_SEAT - 2, "normal ret leaves GRANDPARENT_RET seated");
  assert.deepEqual(m.calls, []);
});

test("loc_5b99 SKIP_BUSY: first entry present+busy -> jr nz at 0x5bc9", () => {
  const m = makeMachine(); seat(m); passGuards(m);
  m.mem.write8(IY_OUTER + 0x00, 0x03); // present + busy
  loc_5b99(m);
  assert.equal(m.tstates, 356);
  assert.deepEqual(m.pcSeq, PC_SKIP_BUSY);
  assert.equal(m.pc, CALLER_RET);
});

test("loc_5b99 SKIP_DX: dx out of range via neg branch -> jr nc at 0x5bee (0x881f!=0 -> e=0x10)", () => {
  const m = makeMachine(); seat(m); passGuards(m);
  m.mem.write8(IY_OUTER + 0x00, 0x01);
  m.mem.write8(0x881f, 0x01);          // e=0x10, jr nz@5bd1 taken
  m.mem.write8(IX + 0x06, 0x00);
  m.mem.write8(IX + 0x05, 0x00);
  m.mem.write8(IY_OUTER + 0x06, 0x20); // 0+0x10-0x20 borrow -> neg -> 0x10 >= 0x10 skip
  loc_5b99(m);
  assert.equal(m.tstates, 518);
  assert.deepEqual(m.pcSeq, PC_SKIP_DX);
  assert.equal(m.pc, CALLER_RET);
});

test("loc_5b99 SKIP_DY: dx in range, dy out of range -> jr nc at 0x5c16 (incs=2)", () => {
  const m = makeMachine(); seat(m); passGuards(m); alignDx(m);
  m.mem.write8(0x8907, 0x01);          // Y e=0x16 (jr nz@5bf9 taken)
  m.mem.write8(IX + 0x04, 0x00);
  m.mem.write8(IX + 0x03, 0x00);
  m.mem.write8(IY_OUTER + 0x04, 0x00); // 0-0x16-0 = 0xEA no borrow, 0xEA >= 9 skip
  loc_5b99(m);
  assert.equal(m.tstates, 680);
  assert.deepEqual(m.pcSeq, PC_SKIP_DY);
  assert.equal(m.pc, CALLER_RET);
});

// --- aligned-hit paths (inner scan; both exit via pop af; ret to GRANDPARENT_RET) ---

test("loc_5b99 HIT_NOMATCH: aligned, inner scans 5 slots with no match -> pop af; ret at 0x5c45", () => {
  const m = makeMachine(); seat(m); passGuards(m); alignDx(m);
  m.mem.write8(0x8907, 0x00);          // Y e=0x12 (jr nz@5bf9 not taken)
  m.mem.write8(IX + 0x04, 0x04);       // shifted a = 0x20
  m.mem.write8(IX + 0x03, 0x00);
  m.mem.write8(IY_OUTER + 0x04, 0x0e); // 0x20-0x12-0x0e = 0 aligned (no neg)
  m.mem.write8(IX + 0x07, 0x00);       // bit1 clear -> de=0x5c80 (jr z@5c1f taken)
  m.mem.write8(IX + 0x14, 0x55);       // id, no inner slot matches (all 0)
  loc_5b99(m);
  assert.equal(m.tstates, 1043);
  assert.deepEqual(m.pcSeq, PC_HIT_NOMATCH);
  assert.equal(m.pc, GRANDPARENT_RET, "pop af; ret unwinds to caller's caller");
  assert.equal(m.regs.sp, SP_SEAT, "stack fully unwound past the seated CALLER_RET");
  assert.equal(m.regs.af, CALLER_RET, "pop af drank loc_5b99's own return");
  assert.deepEqual(m.calls, [0x381e], "sprite-stamp call only, no found handler");
  assert.equal(m.mem.read8(IX + 0x12), 0x10, "ix+0x12 stamped");
  assert.equal(m.mem.read8(IX + 0x16), 0x02, "ix+0x16 set to 2 on hit");
});

test("loc_5b99 HIT_MATCH: aligned via Y neg, match on iter 2 -> found handler, jr z@5c67 not taken", () => {
  const m = makeMachine(); seat(m); passGuards(m); alignDx(m);
  m.mem.write8(0x8907, 0x00);          // Y e=0x12
  m.mem.write8(IX + 0x04, 0x03);       // shifted a = 0x18
  m.mem.write8(IX + 0x03, 0x00);
  m.mem.write8(IY_OUTER + 0x04, 0x0a); // 0x18-0x12-0x0a borrow -> neg -> 0x04 < 9 aligned
  m.mem.write8(IX + 0x07, 0x02);       // bit1 set -> de=0x5c89 (jr z@5c1f not taken)
  m.mem.write8(IX + 0x14, 0x55);
  m.mem.write8(IY_INNER + 0 * 0x18 + 0x14, 0x00); // iter1 no
  m.mem.write8(IY_INNER + 1 * 0x18 + 0x14, 0x55); // iter2 match
  m.mem.write8(IY_INNER + 1 * 0x18 + 0x0b, 0x01); // (iy+0x0b) bit0 set -> jr z@5c67 not taken
  loc_5b99(m);
  assert.equal(m.tstates, 956);
  assert.deepEqual(m.pcSeq, PC_HIT_MATCH);
  assert.equal(m.pc, GRANDPARENT_RET);
  assert.equal(m.regs.sp, SP_SEAT, "stack fully unwound (all 3 call push16 matched a pop)");
  assert.deepEqual(m.calls, [0x381e, 0x0c45, 0x5c75], "sprite stamp + found handler's two calls");
  assert.equal(m.mem.read8(IY_INNER + 1 * 0x18 + 0x16), 0x02, "matched slot iy+0x16 set to 2");
});

test("loc_5b99 HIT_MATCH_B: aligned, match on iter 1 -> found handler, jr z@5c67 taken", () => {
  const m = makeMachine(); seat(m); passGuards(m); alignDx(m);
  m.mem.write8(0x8907, 0x00);
  m.mem.write8(IX + 0x04, 0x04);
  m.mem.write8(IX + 0x03, 0x00);
  m.mem.write8(IY_OUTER + 0x04, 0x0e); // aligned 0
  m.mem.write8(IX + 0x07, 0x00);       // bit1 clear -> de=0x5c80
  m.mem.write8(IX + 0x14, 0x55);
  m.mem.write8(IY_INNER + 0 * 0x18 + 0x14, 0x55); // iter1 match
  m.mem.write8(IY_INNER + 0 * 0x18 + 0x0b, 0x00); // (iy+0x0b) bit0 clear -> jr z@5c67 taken
  loc_5b99(m);
  assert.equal(m.tstates, 870);
  assert.deepEqual(m.pcSeq, PC_HIT_MATCH_B);
  assert.equal(m.pc, GRANDPARENT_RET);
  assert.equal(m.regs.sp, SP_SEAT);
  assert.deepEqual(m.calls, [0x381e, 0x0c45, 0x5c75]);
  assert.equal(m.mem.read8(IY_INNER + 0x16), 0x02, "matched slot (iter1) iy+0x16 set to 2");
});

// --- T-state mutation tooth ---

test("loc_5b99 MUTATION: `add iy,de` in the inner loop mis-charged 11T (not 15T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  // 0x5c42 is the djnz target after add iy,de@0x5c40; mis-charge the add iy,de (steps to 0x5c42).
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x5c42 ? 11 : cycles);
  seat(m); passGuards(m); alignDx(m);
  m.mem.write8(0x8907, 0x00);
  m.mem.write8(IX + 0x04, 0x04);
  m.mem.write8(IX + 0x03, 0x00);
  m.mem.write8(IY_OUTER + 0x04, 0x0e);
  m.mem.write8(IX + 0x07, 0x00);
  m.mem.write8(IX + 0x14, 0x55); // no match -> 5 add iy,de, each mis-charged -4T
  loc_5b99(m);
  assert.equal(m.tstates, 1043 - 5 * 4, "mutation loses 4T per inner add iy,de (5 iters)");
  assert.throws(
    () => assert.equal(m.tstates, 1043, "HIT_NOMATCH T-state total"),
    /1043/,
    "the 1033-T golden must fail on the mutant",
  );
});
