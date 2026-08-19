// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for the loc_5a56 cluster (ROM 0x5a56-0x5a9b): the variant-C score-drip step
// (ring 0x882a, counter 0x8824, coord pair 0x882b/0x882c) plus the shared accumulate tail
// loc_5a8a (full-wrap seed A=0x63) / loc_5a8c (add to score 0x8802, clamp 0x63) / loc_5a97
// (queue display cmd 0x0701 via rst 0x38, ret). Self-contained mock (real Regs). Returning
// callees (0x0f09, rst 0x38 -> 0x0038) balance their pushed slot; tail delegates are record-only.
//
// Run: node --test games/pooyan/translated/test/loc_5a56.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5a56, loc_5a8a, loc_5a8c, loc_5a97 } from "../loc_5a56.js";

const CALLER_RET = 0xabcd;
const RETURNING = new Set([0x0f09, 0x0038, 0x0010]);

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
    call(addr) { this.calls.push(addr); if (RETURNING.has(addr)) regs.sp = (regs.sp + 2) & 0xffff; return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); return m.regs.sp; }

// ── loc_5a56 full path: ring==1, partial wrap -> jr nz to 0x5a8c ─────────────────────────────────
function setupFull(m) {
  const sp0 = seatCaller(m);
  m.mem.write8(0x8810, 0x01); // bit0 -> carry after 1 rrca
  m.mem.write8(0x882a, 0x00); // rl -> 0x01 -> ring low-3 == 1
  m.mem.write8(0x8824, 0x00); // counter, inc -> 0x01
  m.mem.write8(0x882b, 0x20); // first coord: +0x10 -> 0x30 = B
  m.mem.write8(0x882c, 0x25); // second coord < B -> sub b borrows -> ret nc not taken
  return sp0;
}

test("loc_5a56 full: ring==1, partial wrap -> counter++, coords rewritten, jr nz 0x5a8c; 250 T", () => {
  const m = makeMachine();
  const sp0 = setupFull(m);

  loc_5a56(m);

  assert.equal(m.tstates, 250, "loc_5a56 full-path T-state total");
  assert.equal(m.pc, 0x5a8c, "partial wrap tail-delegates to 0x5a8c");
  assert.deepEqual(m.calls, [0x0f09, 0x5a8c], "drip helper then shared tail");
  assert.equal(m.mem.read8(0x8824), 0x01, "(0x8824) counter incremented");
  assert.equal(m.mem.read8(0x882b), 0x00, "(0x882b) first coord: 0x30 then neg-wrapped to 0x00");
  assert.equal(m.mem.read8(0x882c), 0x25, "(0x882c) second coord untouched");
  assert.equal(m.regs.a, 0x05, "A = second coord low nibble (!= 0x0f)");
  assert.equal(m.regs.sp, sp0, "0x0f09 push balanced; tail delegate left SP put");
  assert.deepEqual(m.pcSeq,
    [0x5a59, 0x5a5c, 0x5a5d, 0x5a5f, 0x5a60, 0x5a62, 0x5a64, 0x5a65, 0x5a66, 0x0f09, 0x5a6c,
     0x5a6d, 0x5a6e, 0x5a6f, 0x5a70, 0x5a72, 0x5a73, 0x5a74, 0x5a75, 0x5a76, 0x5a77, 0x5a78,
     0x5a79, 0x5a7a, 0x5a7c, 0x5a7e, 0x5a7f, 0x5a81, 0x5a82, 0x5a83, 0x5a84, 0x5a86, 0x5a88,
     0x5a8c],
    "step boundaries");
});

// ── loc_5a56 full-wrap path: low nibble == 0x0f -> jr nz NOT taken, fall into 0x5a8a ────────────
test("loc_5a56 full wrap: low nibble 0x0f -> falls into 0x5a8a; 245 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8810, 0x01);
  m.mem.write8(0x882a, 0x00);
  m.mem.write8(0x8824, 0x00);
  m.mem.write8(0x882b, 0x20); // -> B = 0x30
  m.mem.write8(0x882c, 0x2f); // < B, low nibble 0x0f

  loc_5a56(m);

  assert.equal(m.tstates, 245, "loc_5a56 full-wrap T-state total");
  assert.equal(m.pc, 0x5a8a, "full wrap falls into 0x5a8a");
  assert.deepEqual(m.calls, [0x0f09, 0x5a8a], "drip helper then full-wrap tail");
});

// ── loc_5a56 ret nz path: ring != 1 -> straight back to caller ──────────────────────────────────
test("loc_5a56 ret nz: ring != 1 -> ret, no drip; 74 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8810, 0x00);
  m.mem.write8(0x882a, 0x00);

  loc_5a56(m);

  assert.equal(m.tstates, 74, "loc_5a56 ret nz T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret nz");
  assert.deepEqual(m.calls, [], "no drip helper reached");
  assert.equal(m.regs.sp, 0x8780, "ret popped the caller slot");
});

// ── loc_5a56 MUTATION: a dropped `rl (hl)` step (15T -> 0) is caught by the golden total ─────────
test("loc_5a56 MUTATION: rl (hl) step dropped (15T -> 0)", () => {
  const m = makeMachine();
  setupFull(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x5a5f ? 0 : c);
  loc_5a56(m);
  assert.equal(m.tstates, 235, "mutation loses the 15 T of rl (hl)");
  assert.notEqual(m.tstates, 250, "golden T-state total catches the dropped step");
});

// ── loc_5a8a: full-wrap entry seeds A=0x63, tail into 0x5a8c ─────────────────────────────────────
test("loc_5a8a: A=0x63, tail-delegates to 0x5a8c; 7 T", () => {
  const m = makeMachine();
  const sp0 = seatCaller(m);
  m.regs.a = 0x00;

  loc_5a8a(m);

  assert.equal(m.tstates, 7, "loc_5a8a T-state total");
  assert.equal(m.pc, 0x5a8c, "tail-delegates to 0x5a8c");
  assert.equal(m.regs.a, 0x63, "A seeded to 0x63");
  assert.deepEqual(m.calls, [0x5a8c], "delegates to the accumulate body");
  assert.equal(m.regs.sp, sp0, "tail delegate leaves SP put");
  assert.deepEqual(m.pcSeq, [0x5a8c], "single step");
});

// ── loc_5a8c path 1: score + A stays below 0x63 -> jr c skips the clamp ──────────────────────────
test("loc_5a8c below cap: 0x10 + 0x05 -> 0x15, jr c to 0x5a97; 43 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x10;
  m.mem.write8(0x8802, 0x05);

  loc_5a8c(m);

  assert.equal(m.tstates, 43, "loc_5a8c below-cap T-state total");
  assert.equal(m.pc, 0x5a97, "tail-delegates to 0x5a97");
  assert.equal(m.mem.read8(0x8802), 0x15, "(0x8802) score accumulated, not clamped");
  assert.deepEqual(m.calls, [0x5a97], "delegates to the display-queue tail");
  assert.deepEqual(m.pcSeq, [0x5a8f, 0x5a90, 0x5a91, 0x5a93, 0x5a97], "step boundaries");
});

// ── loc_5a8c path 2: score + A reaches 0x63 -> clamp to 0x63 ─────────────────────────────────────
test("loc_5a8c at cap: 0x60 + 0x50 -> clamp (0x8802)=0x63; 48 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x60;
  m.mem.write8(0x8802, 0x50);

  loc_5a8c(m);

  assert.equal(m.tstates, 48, "loc_5a8c clamp T-state total");
  assert.equal(m.pc, 0x5a97, "tail-delegates to 0x5a97");
  assert.equal(m.mem.read8(0x8802), 0x63, "(0x8802) clamped to 0x63");
  assert.deepEqual(m.pcSeq, [0x5a8f, 0x5a90, 0x5a91, 0x5a93, 0x5a95, 0x5a97], "step boundaries");
});

// ── loc_5a97: queue display command 0x0701 (rst 0x38), then ret ─────────────────────────────────
test("loc_5a97: DE=0x0701, rst 0x38, ret to caller; 31 T", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_5a97(m);

  assert.equal(m.tstates, 31, "loc_5a97 T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.equal(m.regs.de, 0x0701, "DE = display command 0x0701");
  assert.deepEqual(m.calls, [0x0038], "rst 0x38 delegates to 0x0038");
  assert.equal(m.regs.sp, 0x8780, "rst 0x38 push balanced; ret popped the caller slot");
  assert.deepEqual(m.pcSeq, [0x5a9a, 0x0038, CALLER_RET], "step boundaries");
});
