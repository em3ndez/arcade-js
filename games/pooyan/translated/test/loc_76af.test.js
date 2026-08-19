// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_76af (ROM 0x76af-0x76d3): the 2-phase blink timer on (0x892a)/(0x892b).
// Self-contained flat-RAM mock (real Regs for exact flags). The two 2-byte tile pairs it reads live
// at 0x76e6/0x76e8; those ROM bytes are seeded as literals so no real ROM is needed.
//
// Run: node --test games/pooyan/translated/test/loc_76af.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_76af } from "../loc_76af.js";

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
  const m = {
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(c = 10) { this.step(this.pop16(), c); },
    call(a) { this.calls.push(a); return undefined; },
  };
  regs.sp = 0x8780; m.push16(CALLER_RET);
  return m;
}

function seedPairs(m) {
  m.mem.write8(0x76e6, 0x3f); m.mem.write8(0x76e7, 0x46); // parity-1 pair
  m.mem.write8(0x76e8, 0x46); m.mem.write8(0x76e9, 0x3f); // parity-0 pair
}

// ── expired, phase toggles to odd (parity 1) -> pair {0x3f,0x46} ────────────────────────────────
test("loc_76af: countdown expired, parity 1 -> reload 0x16, write {0x3f,0x46}; 171 T", () => {
  const m = makeMachine();
  seedPairs(m);
  m.mem.write8(0x892a, 0x00); // expired
  m.mem.write8(0x892b, 0x00); // inc -> 1 (odd)

  loc_76af(m);

  assert.equal(m.tstates, 171, "T total");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.deepEqual(m.calls, [], "leaf");
  assert.equal(m.mem.read8(0x892a), 0x16, "countdown reloaded");
  assert.equal(m.mem.read8(0x892b), 0x01, "phase advanced");
  assert.equal(m.mem.read8(0x8471), 0x3f, "first tile");
  assert.equal(m.mem.read8(0x84b1), 0x46, "second tile (0x8471+0x40)");
  assert.deepEqual(m.pcSeq,
    [0x76b2, 0x76b3, 0x76b4, 0x76b8, 0x76ba, 0x76bb, 0x76bc, 0x76bd, 0x76bf, 0x76c2,
     0x76c7, 0x76ca, 0x76cd, 0x76ce, 0x76cf, 0x76d0, 0x76d1, 0x76d2, 0x76d3, CALLER_RET],
    "step boundaries");
});

// ── expired, phase toggles to even (parity 0) -> pair {0x46,0x3f} ───────────────────────────────
test("loc_76af: countdown expired, parity 0 -> write {0x46,0x3f}; 176 T", () => {
  const m = makeMachine();
  seedPairs(m);
  m.mem.write8(0x892a, 0x00);
  m.mem.write8(0x892b, 0x01); // inc -> 2 (even)

  loc_76af(m);

  assert.equal(m.tstates, 176, "T total (jr nz not taken + extra ld de)");
  assert.equal(m.mem.read8(0x8471), 0x46, "first tile");
  assert.equal(m.mem.read8(0x84b1), 0x3f, "second tile");
  assert.equal(m.pcSeq[10], 0x76c4, "took the parity-0 ld de,0x76e8 leg");
});

// ── still counting -> dec (hl) and return ───────────────────────────────────────────────────────
test("loc_76af: countdown non-zero -> dec and ret; 49 T", () => {
  const m = makeMachine();
  m.mem.write8(0x892a, 0x05);

  loc_76af(m);

  assert.equal(m.tstates, 49, "T total");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.equal(m.mem.read8(0x892a), 0x04, "countdown decremented");
  assert.equal(m.mem.read8(0x892b), 0x00, "phase untouched");
  assert.deepEqual(m.pcSeq, [0x76b2, 0x76b3, 0x76b4, 0x76b6, 0x76b7, CALLER_RET], "step boundaries");
});

test("loc_76af MUTATION: `add hl,bc` at 0x76d0 mis-charged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  seedPairs(m);
  m.mem.write8(0x892a, 0x00);
  m.mem.write8(0x892b, 0x00);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x76d1 ? 7 : c); // landing after add hl,bc
  loc_76af(m);
  assert.equal(m.tstates, 167, "mutation loses 4 T (11 -> 7)");
  assert.notEqual(m.tstates, 171, "golden T-state total catches the mutant");
});
