// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_77c8 (ROM 0x77c8-0x780e): actor-slot clear + colorRAM integrity chain.
// Flat-RAM mock (all needed bytes written as literals, incl. (0x780e)=0xc9). The pass exit is `ret`;
// a neighbour mismatch throws (data-table trap); a sum mismatch tail-delegates to 0x2334.
// Run: node --test games/pooyan/translated/test/loc_77c8.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_77c8 } from "../loc_77c8.js";

const CALLER_RET = 0xabcd;
const IX = 0x8a00;

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

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); m.regs.ix = IX; }

// The 11-cell colorRAM column 0x817c..0x82bc (step 0x20); all equal V so the neighbour chain passes.
function seedColumn(m, v) {
  for (let a = 0x817c; a <= 0x82bc; a += 0x20) m.mem.write8(a, v);
}

test("loc_77c8: (IX+0x13) < 5 -> clears slot then ret c; 193 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x13, 0x03);

  loc_77c8(m);

  assert.equal(m.tstates, 193, "early-ret T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret c");
  assert.deepEqual(m.calls, [], "no delegate on early ret");
  for (const off of [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x16]) {
    assert.equal(m.mem.read8(IX + off), 0x00, `(IX+${off.toString(16)}) cleared`);
  }
  assert.deepEqual(m.pcSeq,
    [0x77c9, 0x77cc, 0x77cf, 0x77d2, 0x77d5, 0x77d8, 0x77db, 0x77de, 0x77e1, 0x77e4, 0x77e6, CALLER_RET],
    "step boundaries");
});

test("loc_77c8: integrity PASS -> seeds slot, sum+0x83==(0x780e), ret; 843 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x13, 0x05); // >= 5 -> run the checksum
  seedColumn(m, 0x07);           // 10 summed cells * 7 = 0x46; 0x46 + 0x83 = 0xc9
  m.mem.write8(0x780e, 0xc9);    // the shared `ret` byte the sum is compared against

  loc_77c8(m);

  assert.equal(m.tstates, 843, "pass-path T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret (sum matched)");
  assert.deepEqual(m.calls, [], "jp nz not taken -> no 0x2334 delegate");
  assert.equal(m.regs.a, 0xc9, "A = running sum + 0x83");
  assert.equal(m.mem.read8(IX + 0x01), 0x01, "(IX+1) seeded 0x01");
  assert.equal(m.mem.read8(IX + 0x02), 0x03, "(IX+2) seeded 0x03");
  assert.equal(m.mem.read8(IX + 0x11), 0x80, "(IX+0x11) seeded 0x80");
  const reads = m.pcSeq.filter((p) => p === 0x77fd).length;
  const skips = m.pcSeq.filter((p) => p === 0x7801).length;
  assert.equal(reads, 10, "ld a,(hl) fires once per cell");
  assert.equal(skips, 10, "jr nz never taken -> reaches add a,c each cell");
});

test("loc_77c8 MUTATION: `add hl,de` mis-charged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x13, 0x05);
  seedColumn(m, 0x07);
  m.mem.write8(0x780e, 0xc9);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x77fe ? 7 : c); // fires 10x (once per loop)
  loc_77c8(m);
  assert.equal(m.tstates, 803, "mutation loses 10*4 = 40 T");
  assert.notEqual(m.tstates, 843, "golden T-state total catches the mutant");
});

test("loc_77c8: neighbour mismatch -> data-table trap throws", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x13, 0x05);
  m.mem.write8(0x82bc, 0x07);
  m.mem.write8(0x829c, 0x08); // differs from its neighbour -> jr nz into 0x7875
  assert.throws(() => loc_77c8(m), /0x7875/, "neighbour mismatch is a tamper trap");
});

test("loc_77c8: sum mismatch -> tail-delegates to 0x2334", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x13, 0x05);
  seedColumn(m, 0x07);
  m.mem.write8(0x780e, 0x00); // sum 0xc9 != 0x00 -> jp nz taken
  loc_77c8(m);
  assert.deepEqual(m.calls, [0x2334], "delegates to 0x2334 on sum mismatch");
  assert.equal(m.pc, 0x2334, "tail-jump lands at 0x2334");
});
