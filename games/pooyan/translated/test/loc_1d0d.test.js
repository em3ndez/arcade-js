// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for the loc_1d0d cluster (ROM 0x1d0d-0x1dca): loc_1d0d (tail-jump seed),
// loc_1d15 (sprite clear + branch), loc_1d3c (state reset + table copy), loc_1d6e ((0x8f4a)
// countdown), loc_1d9c (bit tally). Self-contained mock (real Regs, flat 64K RAM). Returning
// callees are balanced (SP += 2); rst 0x10 also runs its HL+=B / B=0 memset side effect.
//
// Run: node --test games/pooyan/translated/test/loc_1d0d.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1d0d, loc_1d15, loc_1d3c, loc_1d6e, loc_1d9c } from "../loc_1d0d.js";

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

// Balances mid-body returning calls; rst 0x10 (0x0010) also applies its memset (HL += B, B = 0).
function installBalancingCalls(m) {
  m.call = (a) => {
    m.calls.push(a);
    m.regs.sp = (m.regs.sp + 2) & 0xffff;
    if (a === 0x0010) { m.regs.hl = (m.regs.hl + m.regs.b) & 0xffff; m.regs.b = 0; }
    return undefined;
  };
}

// ── loc_1d0d: seed (0x8740)=1, tail-jump to 0x1cec (boundary) ──────────────────────────────────
test("loc_1d0d: (0x8740)=1 then tail m.call(0x1cec); 32 T, no ret", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_1d0d(m);

  assert.equal(m.tstates, 10 + 10 + 12, "seed + jr T-state total");
  assert.equal(m.regs.hl, 0x8740, "HL = 0x8740");
  assert.equal(m.mem.read8(0x8740), 0x01, "(0x8740) = 1");
  assert.deepEqual(m.calls, [0x1cec], "tail-jumps to 0x1cec");
  assert.equal(m.pc, 0x1cec, "final PC at the delegate landing");
  assert.equal(m.regs.sp, 0x877e, "no push, no ret: caller return still seated");
  assert.deepEqual(m.pcSeq, [0x1d10, 0x1d12, 0x1cec], "step boundaries");
});

test("loc_1d0d MUTATION: `ld (hl),n` (0x1d12) mis-charged 7T (not 10T) is caught", () => {
  const m = makeMachine(); seatCaller(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1d12 ? 7 : c);
  loc_1d0d(m);
  assert.equal(m.tstates, 29, "mutation loses 3 T");
  assert.notEqual(m.tstates, 32, "golden total catches the mutant");
});

// ── loc_1d15: (0x880e)!=0 skips call z,0x1d0d, takes call nz,0x1ce7, then seeds restart bytes ───
test("loc_1d15 fall-through: call nz,0x1ce7 taken, (0x8805)=2/(0x881f)=1; 174 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installBalancingCalls(m);
  m.mem.write8(0x880e, 0x05); // nonzero -> and a NZ
  m.mem.write8(0x8802, 0x03); // nonzero -> jr z,0x1d3c not taken

  loc_1d15(m);

  assert.equal(m.tstates, 174, "fall-through T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.equal(m.regs.sp, 0x8780, "both balanced calls + ret balance SP");
  assert.deepEqual(m.calls, [0x0010, 0x1ce7], "rst 0x10 fill, then call nz 0x1ce7");
  assert.equal(m.mem.read8(0x8806), 0x00, "(0x8806)=0");
  assert.equal(m.mem.read8(0x880a), 0x00, "(0x880a)=0");
  assert.equal(m.mem.read8(0x881f), 0x01, "(0x881f)=1");
  assert.equal(m.mem.read8(0x8805), 0x02, "(0x8805)=2");
});

test("loc_1d15 delegate: (0x880e)=0 -> call z,0x1d0d; (0x8802)=0 -> jr z delegate loc_1d3c", () => {
  const m = makeMachine();
  seatCaller(m);
  installBalancingCalls(m);
  m.mem.write8(0x880e, 0x00); // -> call z,0x1d0d taken
  m.mem.write8(0x8802, 0x00); // -> jr z,0x1d3c taken

  loc_1d15(m);

  assert.deepEqual(m.calls, [0x0010, 0x1d0d, 0x1d3c], "fill, call z, then delegate");
  assert.equal(m.pc, 0x1d3c, "tail-delegates to loc_1d3c");
});

test("loc_1d15 MUTATION: dropping the `ld a,(0x880e)` step (0x1d1f) loses 13 T", () => {
  const m = makeMachine(); seatCaller(m); installBalancingCalls(m);
  m.mem.write8(0x880e, 0x05); m.mem.write8(0x8802, 0x03);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1d1f ? 0 : c);
  loc_1d15(m);
  assert.equal(m.tstates, 174 - 13, "mutation loses 13 T");
});

// ── loc_1d3c: reset state, call 0x02b9/0x0ecf, copy halved table until 0x7f ─────────────────────
test("loc_1d3c: writes reset block, copies one byte then 0x7f terminator; 249 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installBalancingCalls(m);
  m.mem.write8(0x1e4c, 0x10); // first table byte -> srl -> 0x08
  m.mem.write8(0x1e4d, 0x7f); // terminator

  loc_1d3c(m);

  assert.equal(m.tstates, 249, "T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret z");
  assert.equal(m.regs.sp, 0x8780, "SP balanced");
  assert.deepEqual(m.calls, [0x02b9, 0x0ecf], "delegates");
  assert.equal(m.mem.read8(0x89f0), 0x08, "(0x89f0) = 0x10 >> 1");
  assert.equal(m.mem.read8(0x8805), 0x01, "(0x8805)=1");
  assert.equal(m.mem.read8(0x881f), 0x01, "(0x881f)=1");
  assert.equal(m.mem.read8(0x8f3f), 0x01, "(0x8f3f)=1");
  assert.equal(m.mem.read8(0x8e51), 0x00, "(0x8e51)=0");
  assert.equal(m.pcSeq.filter((p) => p === 0x1d63).length, 2, "loop body runs twice (1 copy + terminator)");
});

test("loc_1d3c MUTATION: dropping the `srl a` step (0x1d68) loses 8 T", () => {
  const m = makeMachine(); seatCaller(m); installBalancingCalls(m);
  m.mem.write8(0x1e4c, 0x10); m.mem.write8(0x1e4d, 0x7f);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1d68 ? 0 : c);
  loc_1d3c(m);
  assert.equal(m.tstates, 249 - 8, "mutation loses 8 T");
});

// ── loc_1d6e: (0x8f4a) countdown ───────────────────────────────────────────────────────────────
test("loc_1d6e event: (0x8f4a)==0x40 -> fire 0x79e9/rst-0x38/0x0f44; 107 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installBalancingCalls(m);
  m.mem.write8(0x8f4a, 0x40);

  loc_1d6e(m);

  assert.equal(m.tstates, 107, "event path T");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.equal(m.regs.sp, 0x8780, "SP balanced");
  assert.deepEqual(m.calls, [0x79e9, 0x0038, 0x0f44], "event calls");
  assert.equal(m.mem.read8(0x8f4a), 0x3f, "(0x8f4a) decremented");
  assert.equal(m.regs.de, 0x0626, "DE = event code 0x0626");
});

test("loc_1d6e restart: (0x8f4a)==0 -> reseat (0x8f50)/(0x8d07)/(0x8f61); 162 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installBalancingCalls(m);
  m.mem.write8(0x8f4a, 0x00);
  m.mem.write8(0x8907, 0x00); // bit1 clear -> ret nz not taken

  loc_1d6e(m);

  assert.equal(m.tstates, 162, "restart path T");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.deepEqual(m.calls, [], "no calls on this path");
  assert.equal(m.mem.read8(0x8f4a), 0xff, "(0x8f4a) wrapped");
  assert.equal(m.mem.read8(0x880a), 0x00, "(0x880a)=0");
  assert.equal(m.mem.read8(0x8f50), 0x02, "(0x8f50)=2");
  assert.equal(m.mem.read8(0x8d07), 0x40, "(0x8d07)=0x40");
  assert.equal(m.mem.read8(0x8f61), 0x01, "(0x8f61)=1 (bit1 clear)");
});

test("loc_1d6e MUTATION: dropping the `dec (hl)` step (0x1d73) loses 11 T", () => {
  const m = makeMachine(); seatCaller(m); installBalancingCalls(m);
  m.mem.write8(0x8f4a, 0x40);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1d73 ? 0 : c);
  loc_1d6e(m);
  assert.equal(m.tstates, 107 - 11, "mutation loses 11 T");
});

// ── loc_1d9c: bit0/bit3 tally over 0x20 reads of a constant cell ───────────────────────────────
test("loc_1d9c simple: (0x8907) bit1 clear -> call 0x0fd5; 55 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installBalancingCalls(m);
  m.mem.write8(0x8907, 0x00);

  loc_1d9c(m);

  assert.equal(m.tstates, 55, "simple path T");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.deepEqual(m.calls, [0x0fd5], "delegates to 0x0fd5");
});

test("loc_1d9c tally: bit1 set, cell 0x5a28=0 -> A tallies to 0x20==C, ret z; 2027 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installBalancingCalls(m);
  m.mem.write8(0x8907, 0x02); // bit1 set -> loc_1da7
  m.mem.write8(0x5a28, 0x00); // bit0 clear (skip), bit3 clear (inc a) -> +1 per iter

  loc_1d9c(m);

  assert.equal(m.tstates, 2027, "tally path T");
  assert.equal(m.pc, CALLER_RET, "cp c Z -> ret z");
  assert.equal(m.regs.sp, 0x8780, "SP balanced");
  assert.deepEqual(m.calls, [0x6da6], "loc_1da7 calls 0x6da6");
  assert.equal(m.mem.read8(0x89e7), 0x00, "tally==C -> (0x89e7) NOT raised");
  assert.equal(m.pcSeq.filter((p) => p === 0x1db9).length, 0x20, "loop runs 0x20 times");
});

test("loc_1d9c MUTATION: dropping the `bit 0,(hl)` step (0x1db9) loses 0x20*12 T", () => {
  const m = makeMachine(); seatCaller(m); installBalancingCalls(m);
  m.mem.write8(0x8907, 0x02); m.mem.write8(0x5a28, 0x00);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1db9 ? 0 : c);
  loc_1d9c(m);
  assert.equal(2027 - m.tstates, 0x20 * 12, "32 bit-steps contribute 384 T");
});
