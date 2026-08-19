// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for the loc_0cf8 cluster (ROM 0x0cf8-0x0dff): loc_0cf8 (column-table copy to
// sprite banks), loc_0d61 (rst-0x38 sound events), loc_0d78 (credit post-handler), loc_0da8 (HL
// seat), loc_0dab (start-of-life setup), loc_0de4 (bit3 branch). Self-contained mock (real Regs,
// flat 64K RAM). Returning callees are balanced (SP += 2); rst 0x10 also runs its HL+=B / B=0.
//
// Run: node --test games/pooyan/translated/test/loc_0cf8.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0cf8, loc_0d61, loc_0d78, loc_0da8, loc_0dab, loc_0de4 } from "../loc_0cf8.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(c = 10) { this.step(this.pop16(), c); },
    call(a) { this.calls.push(a); return undefined; }, // record-only (for pure tail-delegate paths)
  };
}
function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

function installBalancingCalls(m) {
  m.call = (a) => {
    m.calls.push(a);
    m.regs.sp = (m.regs.sp + 2) & 0xffff;
    if (a === 0x0010) { m.regs.hl = (m.regs.hl + m.regs.b) & 0xffff; m.regs.b = 0; }
    return undefined;
  };
}

// ── loc_0cf8: copy 0x0c bytes to sprite bank, IX strides -0x20, 0xee ends ──────────────────────
test("loc_0cf8: single-pass copy of 12 bytes then 0xee terminator; 795 T", () => {
  const m = makeMachine();
  seatCaller(m);
  for (let i = 0; i < 12; i++) m.mem.write8(0x0d2f + i, 0x30 + i); // source column
  m.mem.write8(0x0d3b, 0xee); // terminator right after the 12 bytes

  loc_0cf8(m);

  assert.equal(m.tstates, 795, "single-pass T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret z (0xee)");
  assert.deepEqual(m.calls, [], "leaf: no calls");
  // IX starts 0x86a7 and strides by DE=0xffe0 (-0x20) each byte.
  assert.equal(m.mem.read8(0x86a7), 0x30, "byte 0 -> 0x86a7");
  assert.equal(m.mem.read8(0x86a7 - 0x20), 0x31, "byte 1 -> 0x8687");
  assert.equal(m.mem.read8(0x86a7 - 0x20 * 11), 0x30 + 11, "byte 11 -> last cell");
  assert.equal(m.pcSeq.filter((p) => p === 0x0d05).length, 12, "inner loop runs 12 times");
});

test("loc_0cf8 MUTATION: dropping `ld (ix+0),a` step (0x0d08) loses 12*19 T", () => {
  const good = makeMachine(); seatCaller(good);
  for (let i = 0; i < 12; i++) good.mem.write8(0x0d2f + i, 0x30 + i);
  good.mem.write8(0x0d3b, 0xee); loc_0cf8(good);
  const mut = makeMachine(); seatCaller(mut);
  for (let i = 0; i < 12; i++) mut.mem.write8(0x0d2f + i, 0x30 + i);
  mut.mem.write8(0x0d3b, 0xee);
  const realStep = mut.step.bind(mut);
  mut.step = (n, c) => realStep(n, n === 0x0d08 ? 0 : c);
  loc_0cf8(mut);
  assert.equal(good.tstates - mut.tstates, 12 * 19, "12 store-steps contribute 228 T");
});

// ── loc_0d61: rst-0x38 sound events keyed off (0x8802) ─────────────────────────────────────────
test("loc_0d61: (0x8802)=2 -> DE=0x0619 event + 0x0300 event, (0x8805)=2; 109 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installBalancingCalls(m);
  m.mem.write8(0x8802, 0x02);

  loc_0d61(m);

  assert.equal(m.tstates, 109, "T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.equal(m.regs.sp, 0x8780, "SP balanced");
  assert.deepEqual(m.calls, [0x0038, 0x0038], "two rst 0x38 events");
  assert.equal(m.mem.read8(0x8805), 0x02, "(0x8805)=2");
});

test("loc_0d61: (0x8802)=0 -> early ret z; 28 T, no events", () => {
  const m = makeMachine();
  seatCaller(m);
  installBalancingCalls(m);

  loc_0d61(m);

  assert.equal(m.tstates, 13 + 4 + 11, "ret z path");
  assert.equal(m.pc, CALLER_RET, "returns via ret z");
  assert.deepEqual(m.calls, [], "no events");
});

// ── loc_0d78: credit post-handler ──────────────────────────────────────────────────────────────
test("loc_0d78 bit3: (0x8810) bit3 set -> delegate loc_0de4; 31 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8810, 0x08);

  loc_0d78(m);

  assert.equal(m.tstates, 13 + 8 + 10, "jp nz path T");
  assert.deepEqual(m.calls, [0x0de4], "delegates to loc_0de4");
  assert.equal(m.pc, 0x0de4, "tail-jumps to loc_0de4");
});

test("loc_0d78 checksum: bit4 set, 2 credits -> subtract 2, sum, fall to loc_0da8; 1072 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installBalancingCalls(m);
  m.mem.write8(0x8810, 0x10); // bit3 clear, bit4 set
  m.mem.write8(0x8802, 0x05); // >=2 credits
  // 0x776b..0x777e default 0 -> DE sum stays 0x1414; (0x14+0x14)&0xab=0x28 != 0 -> jr z NOT taken

  loc_0d78(m);

  assert.equal(m.tstates, 1072, "checksum path T");
  assert.deepEqual(m.calls, [0x0da8], "falls through to loc_0da8");
  assert.equal(m.pc, 0x0da8, "delegate landing");
  assert.equal(m.mem.read8(0x8802), 0x03, "(0x8802) -= 2");
  assert.equal(m.mem.read8(0x89ea), 0x01, "(0x89ea) bumped (checksum != 0)");
  assert.equal(m.pcSeq.filter((p) => p === 0x0d96).length, 0x14, "sum loop runs 20 times");
});

// ── loc_0da8: seat HL then fall to loc_0dab ────────────────────────────────────────────────────
test("loc_0da8: HL=0x0100 then tail m.call(0x0dab); 10 T", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_0da8(m);

  assert.equal(m.tstates, 10, "single ld hl");
  assert.equal(m.regs.hl, 0x0100, "HL = 0x0100");
  assert.deepEqual(m.calls, [0x0dab], "delegates to loc_0dab");
  assert.equal(m.pc, 0x0dab, "delegate landing");
});

// ── loc_0dab: start-of-life setup ──────────────────────────────────────────────────────────────
test("loc_0dab tail: HL high bit0 set -> full setup incl rst-0x10 clear; 275 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installBalancingCalls(m);
  m.regs.hl = 0x0100; // ld (0x880d),hl -> (0x880e)=0x01 -> rrca carry set -> tail runs

  loc_0dab(m);

  assert.equal(m.tstates, 275, "tail path T");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.equal(m.regs.sp, 0x8780, "SP balanced");
  assert.deepEqual(m.calls, [0x0e54, 0x0038, 0x0e00, 0x0038, 0x0038, 0x0010], "call order");
  assert.equal(m.mem.read8(0x880d), 0x00, "(0x880d)=HL low");
  assert.equal(m.mem.read8(0x880e), 0x01, "(0x880e)=HL high");
  assert.equal(m.mem.read8(0x8805), 0x03, "(0x8805)=3");
  assert.equal(m.mem.read8(0x8806), 0x01, "(0x8806)=1");
  assert.equal(m.mem.read8(0x8d21), 0x00, "(0x8d21)=0");
  assert.equal(m.mem.read8(0x8d22), 0x20, "(0x8d22)=0x20");
  assert.equal(m.regs.e, 0x01, "DE incremented to 0x0401 for the last event");
});

test("loc_0dab early: HL=0 -> (0x880e)=0 -> ret nc before the tail; 224 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installBalancingCalls(m);
  m.regs.hl = 0x0000;

  loc_0dab(m);

  assert.equal(m.tstates, 224, "ret nc path T");
  assert.equal(m.pc, CALLER_RET, "returns via ret nc");
  assert.deepEqual(m.calls, [0x0e54, 0x0038, 0x0e00, 0x0038], "no tail rst 0x38 / rst 0x10");
  assert.equal(m.mem.read8(0x8d22), 0x20, "(0x8d22)=0x20 written before the branch");
});

test("loc_0dab MUTATION: dropping `ld (0x880d),hl` step (0x0dae) loses 16 T", () => {
  const m = makeMachine(); seatCaller(m); installBalancingCalls(m);
  m.regs.hl = 0x0000;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0dae ? 0 : c);
  loc_0dab(m);
  assert.equal(m.tstates, 224 - 16, "mutation loses 16 T");
});

// ── loc_0de4: bit3 branch ──────────────────────────────────────────────────────────────────────
test("loc_0de4: (0x8802)!=0 -> decrement + restart via loc_0dab (HL=0); 54 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8802, 0x04);

  loc_0de4(m);

  assert.equal(m.tstates, 13 + 4 + 7 + 4 + 13 + 10 + 10, "decrement path T");
  assert.deepEqual(m.calls, [0x0dab], "jp 0x0dab");
  assert.equal(m.pc, 0x0dab, "delegate landing");
  assert.equal(m.mem.read8(0x8802), 0x03, "(0x8802) decremented");
  assert.equal(m.regs.hl, 0x0000, "HL=0 handed to loc_0dab");
});

test("loc_0de4: (0x8802)=0, (0x880a)!=0x0e -> (0x8805)=1, ret; 49 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8802, 0x00);
  m.mem.write8(0x880a, 0x05);

  loc_0de4(m);

  assert.equal(m.tstates, 13 + 4 + 12 + 13 + 7 + 5 + 7 + 13 + 10, "loc_0df4 set path T");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.deepEqual(m.calls, [], "no delegate");
  assert.equal(m.mem.read8(0x8805), 0x01, "(0x8805)=1");
});
