// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_79e9 (ROM 0x79e9-0x7a0a): the 0x68ac ROM-integrity checksum.
// Flat-RAM mock (real Regs); the summed span at 0x68ac and the stored word at 0x7a0b are seeded
// as literals. loc_07d0 / loc_1a85 are the anti-tamper abort vectors (record-only m.call).
//
// Run: node --test games/pooyan/translated/test/loc_79e9.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_79e9 } from "../loc_79e9.js";

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
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

// Seed a 3-byte body 0xff,0x02,0xc9 at 0x68ac: sum = 0xff + 0x02 = 0x0101 (one carry into D),
// terminated by the 0xc9. The expected word at 0x7a0b is 0x0101 -> clean match, ret.
function seedMatch(m) {
  m.mem.write8(0x68ac, 0xff);
  m.mem.write8(0x68ad, 0x02);
  m.mem.write8(0x68ae, 0xc9);
  m.mem.write8(0x7a0b, 0x01); // low
  m.mem.write8(0x7a0c, 0x01); // high
}

// ── Match path: sum 0x0101 == stored word -> both compares Z -> ret (exercises the carry->inc d) ──
test("loc_79e9 match: sum 0x0101 (with carry), stored word matches -> ret; 231 T", () => {
  const m = makeMachine();
  seatCaller(m);
  seedMatch(m);

  loc_79e9(m);

  assert.equal(m.tstates, 231, "match-path T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.deepEqual(m.calls, [], "no anti-tamper abort on a clean checksum");
  assert.equal(m.regs.e, 0x01, "E = low byte of the sum");
  assert.equal(m.regs.d, 0x01, "D = carry count (inc d fired once)");
  assert.equal(m.regs.a, 0x01, "A holds D at the second compare");
  assert.equal(m.regs.hl, 0x7a0c, "HL advanced to the high checksum byte");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.deepEqual(m.pcSeq,
    [0x79ec, 0x79ef, 0x79f0, 0x79f2, 0x79f4, 0x79f5, 0x79f8, 0x79f9, 0x79fa, 0x79ef,
     0x79f0, 0x79f2, 0x79f4, 0x79f5, 0x79f7, 0x79f8, 0x79f9, 0x79fa, 0x79ef,
     0x79f0, 0x79f2, 0x79fc, 0x79ff, 0x7a00, 0x7a01, 0x7a04, 0x7a05, 0x7a06, 0x7a07, 0x7a0a, CALLER_RET],
    "match-path boundaries (iter1 no-carry, iter2 carry->inc d, iter3 terminator, then tail)");
});

// ── Low-byte mismatch -> jp nz,0x07d0 (anti-tamper abort) ──────────────────────────────────────
test("loc_79e9 low-byte mismatch -> delegates to 0x07d0", () => {
  const m = makeMachine();
  seatCaller(m);
  seedMatch(m);
  m.mem.write8(0x7a0b, 0x99); // corrupt the stored low byte

  loc_79e9(m);

  assert.deepEqual(m.calls, [0x07d0], "low-byte mismatch aborts to 0x07d0");
  assert.equal(m.pc, 0x07d0, "control transferred to the abort vector");
});

// ── High-byte mismatch -> jp nz,0x1a85 (low matches, high does not) ─────────────────────────────
test("loc_79e9 high-byte mismatch -> delegates to 0x1a85", () => {
  const m = makeMachine();
  seatCaller(m);
  seedMatch(m);
  m.mem.write8(0x7a0c, 0x99); // corrupt the stored high byte only

  loc_79e9(m);

  assert.deepEqual(m.calls, [0x1a85], "high-byte mismatch aborts to 0x1a85");
  assert.equal(m.pc, 0x1a85, "control transferred to the abort vector");
});

// ── MUTATION: the carry-arm `inc d` step mis-charged 12T (not 4T) is caught by the golden total ──
test("loc_79e9 MUTATION: inc d (0x79f7 landing 0x79f8) mis-charged is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  seedMatch(m);
  const realStep = m.step.bind(m);
  let seen = 0; // iter1 lands 0x79f8 via jr-nc-taken (12T); iter2 lands it via `inc d` (4T)
  m.step = (n, c) => { if (n === 0x79f8 && ++seen === 2) return realStep(n, 12); return realStep(n, c); };
  loc_79e9(m);
  assert.equal(m.tstates, 239, "mutation adds 8 T charging the `inc d` arm (4T) as 12T");
  assert.notEqual(m.tstates, 231, "golden T-state total catches the mutant");
});
