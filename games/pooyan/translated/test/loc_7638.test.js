// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for the loc_7638 cluster (ROM 0x7638-0x76af): the per-entry animation tick.
//   loc_7638 -- dispatch (ix+2)&3 through the rst-0x28 table at 0x763e.
//   loc_7644 -- state 0: advance a sub-position; at saturation RESET all 14 entries and CALLER-SKIP.
//   loc_7675 -- state 1: count the 0x892e timer down; at zero re-seed/clear two arrays and CALLER-SKIP.
//   loc_76a6 -- state 2: a (0x8d58) gate; never caller-skips.
//
// Each handler returns a BOOLEAN: true = plain ret back into loc_7627's loop (pops the call-0x7638
// return we seat), false = `pop af; ret` that also pops loc_7627's own return (unwinding a second
// level to a grand-return). Delegated calls (0x4006) are balanced (SP += 2). The dispatcher's
// 0x0028 stays record-only so its pushed table base survives, as loc_0028 would pop it for real.
// Run: node --test games/pooyan/translated/test/loc_7638.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_7638, loc_7644, loc_7675, loc_76a6 } from "../loc_7638.js";

const CALLER_RET = 0x7632; // loc_7627's call-0x7638 return: what a plain ret pops
const GRAND = 0x76f0;      // loc_7627's own return: what a caller-skip's second pop reaches
const MARK = 0x5a5a;

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
    call(addr) { this.calls.push(addr); return MARK; },
  };
}

// Balance a returning callee (0x4006): pop the return we pushed. Caller-skip pop af/ret run on the
// real stack separately, so they are unaffected.
function installBalancingCalls(m) {
  m.call = (addr) => { m.calls.push(addr); m.regs.sp = (m.regs.sp + 2) & 0xffff; return undefined; };
}

// ── loc_7638: dispatcher ──────────────────────────────────────────────────────────────────────
test("loc_7638: masks (ix+2)&3, pushes table base 0x763e, tail-delegates to 0x0028; 37 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
  m.regs.ix = 0x8ae0;
  m.mem.write8(0x8ae2, 0x06); // (ix+2) = 6 -> &3 = 2

  const r = loc_7638(m);

  assert.equal(m.tstates, 37, "19 + 7 + 11");
  assert.equal(m.regs.a, 0x02, "A = (ix+2) & 3 (loc_0028 does the doubling)");
  assert.deepEqual(m.calls, [0x0028], "delegates to the rst-0x28 trampoline");
  assert.equal(m.mem.read16(m.regs.sp), 0x763e, "rst 0x28 pushed the inline table base");
  assert.equal(r, MARK, "propagates loc_0028's return (the handler's caller-skip boolean)");
  assert.deepEqual(m.pcSeq, [0x763b, 0x763d, 0x0028], "step boundaries");
});

test("loc_7638 MUTATION: `ld a,(ix+2)` mis-charged 15T (not 19T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x763b ? 15 : c);
  loc_7638(m);
  assert.equal(m.tstates, 33, "mutation loses the DD-prefix 4 T (19 -> 15)");
  assert.notEqual(m.tstates, 37, "golden T-state total catches the mutant");
});

// ── loc_7644: state 0, normal (still animating) path ──────────────────────────────────────────
function seatTick(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_7644: active entry advances (ix+5), frame < 6 -> ret; 151 T", () => {
  const m = makeMachine();
  seatTick(m);
  installBalancingCalls(m);
  m.regs.ix = 0x8ae0;
  m.mem.write8(0x8ae0, 0x01); // (ix+0) active
  m.mem.write8(0x8ae5, 0x05); // (ix+5)
  m.mem.write8(0x8ae9, 0x03); // (ix+9): 5 - 3 = 2, no borrow -> jr nc
  m.mem.write8(0x8ae6, 0x08); // (ix+6) = 8 >= 6 -> ret nc

  const r = loc_7644(m);

  assert.equal(m.tstates, 151, "loc_7644 normal-path T-state total");
  assert.equal(r, true, "plain ret -> continue the walk");
  assert.equal(m.pc, CALLER_RET, "ret nc popped loc_7627's call return");
  assert.equal(m.regs.sp, 0x8780, "call 0x4006 balanced, ret popped the caller");
  assert.deepEqual(m.calls, [0x4006], "one delegated call");
  assert.equal(m.mem.read8(0x8ae5), 0x02, "(ix+5) := 5 - 3");
  assert.deepEqual(m.pcSeq,
    [0x7647, 0x7648, 0x7649, 0x4006, 0x764f, 0x7652, 0x7657, 0x765a, 0x765d, 0x765f, CALLER_RET],
    "normal-path step boundaries");
});

test("loc_7644 MUTATION: `sub (ix+9)` mis-charged 15T (not 19T) is caught", () => {
  const m = makeMachine();
  seatTick(m);
  installBalancingCalls(m);
  m.regs.ix = 0x8ae0;
  m.mem.write8(0x8ae0, 0x01);
  m.mem.write8(0x8ae5, 0x05);
  m.mem.write8(0x8ae9, 0x03);
  m.mem.write8(0x8ae6, 0x08);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x7652 ? 15 : c);
  loc_7644(m);
  assert.equal(m.tstates, 147, "mutation loses the DD-prefix 4 T (19 -> 15)");
  assert.notEqual(m.tstates, 151, "golden T-state total catches the mutant");
});

// ── loc_7644: saturation path -> reset all entries and caller-skip ────────────────────────────
test("loc_7644: frame hits 6 -> resets 14 entries' (ix+2)=1 and caller-skips; 862 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x8780;
  m.push16(GRAND);       // loc_7627's own return
  m.push16(CALLER_RET);  // loc_7627's call-0x7638 return
  installBalancingCalls(m);
  m.regs.ix = 0x8ae0;
  m.mem.write8(0x8ae0, 0x01); // active
  m.mem.write8(0x8ae5, 0x05);
  m.mem.write8(0x8ae9, 0x03); // no borrow
  m.mem.write8(0x8ae6, 0x03); // (ix+6) = 3 < 6 -> ret nc NOT taken -> reset

  const r = loc_7644(m);

  assert.equal(r, false, "caller-skip signalled");
  assert.equal(m.pc, GRAND, "pop af discarded the call return, ret unwound to loc_7627's caller");
  assert.equal(m.regs.sp, 0x8780, "both stack levels unwound");
  assert.equal(m.mem.read8(0x892e), 0x20, "shared 0x892e reseeded");
  assert.equal(m.mem.read8(0x8ae2), 0x01, "entry 0 state byte reset to 1");
  assert.equal(m.mem.read8(0x8ae2 + 0x18), 0x01, "entry 1 reset too (stride 0x18)");
  assert.equal(m.regs.ix, (0x8ae0 + 14 * 0x18) & 0xffff, "IX walked all 14 entries");
  assert.equal(m.tstates, 862, "reset+skip T-state total");
});

// ── loc_7675: state 1, timer still counting ───────────────────────────────────────────────────
test("loc_7675: timer non-zero -> decrement and ret; 66 T", () => {
  const m = makeMachine();
  seatTick(m);
  installBalancingCalls(m);
  m.mem.write8(0x892e, 0x05);

  const r = loc_7675(m);

  assert.equal(m.tstates, 66, "loc_7675 counting-path T-state total");
  assert.equal(r, true, "plain ret -> continue the walk");
  assert.equal(m.pc, CALLER_RET, "ret popped loc_7627's call return");
  assert.equal(m.regs.sp, 0x8780, "call balanced, ret popped the caller");
  assert.deepEqual(m.calls, [0x4006], "one delegated call");
  assert.equal(m.mem.read8(0x892e), 0x04, "timer decremented");
  assert.deepEqual(m.pcSeq,
    [0x4006, 0x767b, 0x767c, 0x767d, 0x767f, 0x7680, CALLER_RET],
    "counting-path step boundaries");
});

test("loc_7675 MUTATION: `dec (hl)` mis-charged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  seatTick(m);
  installBalancingCalls(m);
  m.mem.write8(0x892e, 0x05);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x7680 ? 7 : c);
  loc_7675(m);
  assert.equal(m.tstates, 62, "mutation loses the RMW 4 T (11 -> 7)");
  assert.notEqual(m.tstates, 66, "golden T-state total catches the mutant");
});

// ── loc_7675: timer expired -> re-seed / clear and caller-skip ─────────────────────────────────
test("loc_7675: timer zero -> seeds 0x8ae2 array, clears 0x8ba2 array, caller-skips; 592 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x8780;
  m.push16(GRAND);
  m.push16(CALLER_RET);
  installBalancingCalls(m);
  m.mem.write8(0x892e, 0x00); // expired
  m.mem.write8(0x8ba2, 0xff); // will be cleared

  const r = loc_7675(m);

  assert.equal(r, false, "caller-skip signalled");
  assert.equal(m.pc, GRAND, "unwound to loc_7627's caller");
  assert.equal(m.regs.sp, 0x8780, "both stack levels unwound");
  assert.equal(m.mem.read8(0x8ae2), 0x02, "first 0x8ae2 entry seeded to state 2");
  assert.equal(m.mem.read8(0x8ae2 + 7 * 0x18), 0x02, "eighth 0x8ae2 entry seeded too");
  assert.equal(m.mem.read8(0x8ba2), 0x00, "first 0x8ba2 entry cleared");
  assert.equal(m.mem.read8(0x8ba2 + 5 * 0x18), 0x00, "sixth 0x8ba2 entry cleared");
  assert.equal(m.mem.read8(0x8d57), 0x00, "(0x8d57) cleared");
  assert.equal(m.mem.read8(0x8e51), 0x08, "sub-state (0x8e51) := 8");
  assert.equal(m.tstates, 592, "seed+clear+skip T-state total");
});

// ── loc_76a6: state 2, gate open -> call 0x4006 then ret ──────────────────────────────────────
test("loc_76a6: (0x8d58)==0 -> call 0x4006, ret; 49 T", () => {
  const m = makeMachine();
  seatTick(m);
  installBalancingCalls(m);
  m.mem.write8(0x8d58, 0x00);

  const r = loc_76a6(m);

  assert.equal(m.tstates, 49, "loc_76a6 gate-open T-state total");
  assert.equal(r, true, "never caller-skips");
  assert.equal(m.pc, CALLER_RET, "ret popped loc_7627's call return");
  assert.equal(m.regs.sp, 0x8780, "call balanced, ret popped the caller");
  assert.deepEqual(m.calls, [0x4006], "one delegated call");
  assert.deepEqual(m.pcSeq, [0x76a9, 0x76aa, 0x76ab, 0x4006, CALLER_RET], "step boundaries");
});

test("loc_76a6: (0x8d58)!=0 -> ret nz immediately; 28 T", () => {
  const m = makeMachine();
  seatTick(m);
  installBalancingCalls(m);
  m.mem.write8(0x8d58, 0x01);

  const r = loc_76a6(m);

  assert.equal(m.tstates, 28, "13 + 4 + 11 (ret nz taken)");
  assert.equal(r, true, "plain return");
  assert.equal(m.pc, CALLER_RET, "ret nz popped the caller");
  assert.deepEqual(m.calls, [], "gate closed -> no delegated call");
  assert.deepEqual(m.pcSeq, [0x76a9, 0x76aa, CALLER_RET], "step boundaries");
});

test("loc_76a6 MUTATION: `ld a,(0x8d58)` mis-charged 7T (not 13T) is caught", () => {
  const m = makeMachine();
  seatTick(m);
  installBalancingCalls(m);
  m.mem.write8(0x8d58, 0x00);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x76a9 ? 7 : c);
  loc_76a6(m);
  assert.equal(m.tstates, 43, "mutation loses 6 T (13 -> 7)");
  assert.notEqual(m.tstates, 49, "golden T-state total catches the mutant");
});
