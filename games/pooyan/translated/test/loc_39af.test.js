// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for the loc_39af cluster (ROM 0x39af-0x3a63, Pooyan): the actor state
// handler split at its three externally-reached entry points (loc_39af, loc_39ba, loc_39e0)
// plus the two jr-reached tail blocks (loc_3a48, loc_3a51). Flat-RAM mock (real Regs). `call`
// is record-only for TAIL dispatch and balances (SP += 2) only the two mid-body calls (0x4006,
// 0x381e), so ret-terminated routines keep a balanced stack. Golden T-states are hand-summed.
//
// Run: node --test games/pooyan/translated/test/loc_39af.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_39af, loc_39ba, loc_39e0, loc_3a48, loc_3a51 } from "../loc_39af.js";

const CALLER_RET = 0xabcd;
const MIDBODY_CALLS = new Set([0x4006, 0x381e]);

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); if (MIDBODY_CALLS.has(addr)) regs.sp = (regs.sp + 2) & 0xffff; return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

// ── loc_39af: run animator, then branch on parity of (0x8907) ─────────────────────────────────
test("loc_39af: (0x8907) odd -> falls through to loc_39ba; 47 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x01);

  loc_39af(m);

  assert.equal(m.tstates, 47, "loc_39af fall-through T");
  assert.deepEqual(m.calls, [0x4006, 0x39ba], "animator then fall to loc_39ba");
  assert.deepEqual(m.pcSeq, [0x4006, 0x39b5, 0x39b7, 0x39ba], "step boundaries");
});

test("loc_39af: (0x8907) even -> jp z 0x3b87; 47 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x00);

  loc_39af(m);

  assert.equal(m.tstates, 47, "loc_39af jp-z T");
  assert.deepEqual(m.calls, [0x4006, 0x3b87], "animator then jp 0x3b87");
  assert.deepEqual(m.pcSeq, [0x4006, 0x39b5, 0x39b7, 0x3b87], "step boundaries");
});

test("loc_39af MUTATION: `call 0x4006` mis-charged 10T (not 17T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x01);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x4006 ? 10 : c);
  loc_39af(m);
  assert.equal(m.tstates, 40, "mutation loses 7 T (17 -> 10)");
  assert.notEqual(m.tstates, 47, "golden T-state total catches the mutant");
});

// ── loc_39ba: integrate velocity into position, then branch ───────────────────────────────────
function setup39ba(m) {
  seatCaller(m);
  m.regs.ix = 0x8c00;
  m.mem.write8(0x8c0a, 0x02); // (ix+0x0a) velocity
  m.mem.write8(0x8c03, 0x50); // (ix+0x03) position -> cp b (0xfe) sets carry -> dec (ix+0x04)
  m.mem.write8(0x8c04, 0x11); // (ix+0x04) -> dec -> 0x10
  m.mem.write8(0x8c07, 0x01); // (ix+0x07) state non-zero (jr z not taken)
}

test("loc_39ba: dec branch, all exits not taken -> falls to loc_39e0; 201 T", () => {
  const m = makeMachine();
  setup39ba(m);

  loc_39ba(m);

  assert.equal(m.tstates, 201, "loc_39ba fall-to-39e0 T");
  assert.deepEqual(m.calls, [0x39e0], "tail into loc_39e0");
  assert.equal(m.mem.read8(0x8c04), 0x10, "(ix+0x04) decremented 0x11 -> 0x10");
  assert.equal(m.mem.read8(0x8c03), 0x52, "(ix+0x03) = 0x50 + velocity 0x02");
  assert.deepEqual(m.pcSeq,
    [0x39bd, 0x39bf, 0x39c0, 0x39c3, 0x39c4, 0x39c6, 0x39c9, 0x39cc, 0x39cf, 0x39d2, 0x39d5,
     0x39d6, 0x39d8, 0x39d9, 0x39db, 0x39dd, 0x39df, 0x39e0],
    "step boundaries");
});

test("loc_39ba: state byte zero -> jr z 0x3a51", () => {
  const m = makeMachine();
  setup39ba(m);
  m.mem.write8(0x8c07, 0x00); // (ix+0x07) == 0 -> and a Z -> jr z 0x3a51

  loc_39ba(m);

  assert.deepEqual(m.calls, [0x3a51], "tail into loc_3a51");
  assert.equal(m.pc, 0x3a51, "landed on 0x3a51");
});

test("loc_39ba MUTATION: `dec (ix+0x04)` mis-charged 6T (not 23T) is caught", () => {
  const m = makeMachine();
  setup39ba(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x39c9 ? 6 : c);
  loc_39ba(m);
  assert.equal(m.tstates, 184, "mutation loses 17 T (23 -> 6)");
  assert.notEqual(m.tstates, 201, "golden T-state total catches the mutant");
});

// ── loc_39e0: fire decision -> shot spawn (delegates to 0x3a6c) ────────────────────────────────
function setup39e0(m) {
  seatCaller(m);
  m.regs.ix = 0x8c00;
  m.mem.write8(0x8d7d, 0x20); // >= 0x0e -> jr nc straight to l_3a08
  m.mem.write8(0x8d75, 0x00); // and a Z -> ret nz not taken
  m.mem.write8(0x8c08, 0x10); // (ix+0x08) & 0xf0 != 0 -> ret z not taken
  m.mem.write8(0x8c15, 0x00); // (ix+0x15) cooldown 0 -> jr z 0x3a1d
  m.mem.write8(0x8842, 0x40); // launcher column
  m.mem.write8(0x881f, 0x01); // direction non-zero -> jr nz skip neg
  m.mem.write8(0x8907, 0x00); // frame parity even -> bit0 zero -> jr z skip add
  m.mem.write8(0x8c04, 0x08); // (ix+0x04): matches target column 0x08 -> jr z 0x3a6c
}

const E0_PC_SEQ = [
  0x39e3, 0x39e4, 0x39e6, 0x3a08,
  0x3a0b, 0x3a0c, 0x3a0d, 0x3a10, 0x3a12, 0x3a13, 0x3a16, 0x3a17, 0x3a1d,
  0x3a20, 0x3a21, 0x3a24, 0x3a25, 0x3a26, 0x3a27, 0x3a2b,
  0x3a2c, 0x3a2d, 0x3a2e, 0x3a30, 0x3a31, 0x3a32, 0x3a33, 0x3a37,
  0x3a3a, 0x3a3b, 0x3a3d, 0x3a3e, 0x3a42, 0x3a45, 0x3a6c,
];

test("loc_39e0: full fire path (column matches) -> delegates to 0x3a6c; 293 T", () => {
  const m = makeMachine();
  setup39e0(m);

  loc_39e0(m);

  assert.equal(m.tstates, 293, "loc_39e0 fire-path T");
  assert.deepEqual(m.calls, [0x3a6c], "spawn shot via 0x3a6c");
  assert.equal(m.regs.c, 0x08, "target column = (0x8842)>>3 & 0x1f");
  assert.deepEqual(m.pcSeq, E0_PC_SEQ, "step boundaries");
});

test("loc_39e0: (ix+0x04) != target column -> plain ret, no shot", () => {
  const m = makeMachine();
  setup39e0(m);
  m.mem.write8(0x8c04, 0x09); // != 0x08 -> jr z not taken -> ret at 0x3a47

  loc_39e0(m);

  assert.equal(m.pc, CALLER_RET, "returns via ret 0x3a47");
  assert.deepEqual(m.calls, [], "no shot spawned");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
});

test("loc_39e0 MUTATION: `cp (ix+0x04)` mis-charged 7T (not 19T) is caught", () => {
  const m = makeMachine();
  setup39e0(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x3a45 ? 7 : c);
  loc_39e0(m);
  assert.equal(m.tstates, 281, "mutation loses 12 T (19 -> 7)");
  assert.notEqual(m.tstates, 293, "golden T-state total catches the mutant");
});

// ── loc_3a48 / loc_3a51: the jr-reached tail blocks ───────────────────────────────────────────
test("loc_3a48: reset sub-state and reload timer; 48 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8c00;
  m.mem.write8(0x8c02, 0x07);

  loc_3a48(m);

  assert.equal(m.tstates, 48, "loc_3a48 T");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.equal(m.mem.read8(0x8c02), 0x00, "(ix+0x02) cleared");
  assert.equal(m.mem.read8(0x8c11), 0x20, "(ix+0x11) reloaded");
  assert.deepEqual(m.pcSeq, [0x3a4c, 0x3a50, CALLER_RET], "step boundaries");
});

test("loc_3a51: B<2 -> seat 0x3bd1 animation via call 0x381e; 91 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8c00;
  m.regs.b = 0x01;

  loc_3a51(m);

  assert.equal(m.tstates, 91, "loc_3a51 call path T");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.equal(m.regs.sp, 0x8780, "call push balanced, ret popped caller");
  assert.deepEqual(m.calls, [0x381e], "seats animation via loc_381e");
  assert.equal(m.regs.de, 0x3bd1, "DE = 0x3bd1 animation pointer");
  assert.equal(m.mem.read8(0x8c02), 0x02, "(ix+0x02) = 2");
  assert.equal(m.mem.read8(0x8c11), 0x28, "(ix+0x11) = 0x28");
  assert.deepEqual(m.pcSeq, [0x3a52, 0x3a54, 0x3a55, 0x3a58, 0x381e, 0x3a5f, 0x3a63, CALLER_RET], "step boundaries");
});

test("loc_3a51: B>=2 -> ret nc, no call; 22 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8c00;
  m.regs.b = 0x02;

  loc_3a51(m);

  assert.equal(m.tstates, 22, "loc_3a51 ret-nc T");
  assert.deepEqual(m.calls, [], "no call on the early return");
  assert.deepEqual(m.pcSeq, [0x3a52, 0x3a54, CALLER_RET], "step boundaries");
});

test("loc_3a51 MUTATION: `call 0x381e` mis-charged 10T (not 17T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8c00;
  m.regs.b = 0x01;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x381e ? 10 : c);
  loc_3a51(m);
  assert.equal(m.tstates, 84, "mutation loses 7 T (17 -> 10)");
  assert.notEqual(m.tstates, 91, "golden T-state total catches the mutant");
});
