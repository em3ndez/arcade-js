// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_059d (ROM 0x059d-0x05b1): the single-digit tile writer.
// LEAF -- no calls; its only stack traffic is the closing ret popping the caller return, so the
// SP-balance assertion (sp == 0x8780 after ret) is the stack tooth. Three paths: a non-zero
// nibble (store as-is, clear C), a zero nibble with C==0 (store real 0), and a zero nibble with
// C>0 (store blank tile 0x10, C--). Golden own-T-state totals + a mis-charge mutation are the teeth.
//
// Run: node --test games/pooyan/translated/test/loc_059d.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_059d } from "../loc_059d.js";

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
    call(addr) { this.calls.push(addr); this.ret(0); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

// ── Path 1: non-zero nibble -> store the digit, clear C, step ix by DE ──────────────────────────
test("loc_059d non-zero nibble: store digit, C:=0; 65 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x35; // low nibble 5
  m.regs.c = 0x04;
  m.regs.ix = 0x8781;
  m.regs.de = 0xffe0;

  loc_059d(m);

  assert.equal(m.tstates, 65, "non-zero-nibble own T total");
  assert.equal(m.pc, CALLER_RET, "ret returns to caller");
  assert.equal(m.regs.sp, 0x8780, "stack balanced -- leaf ret pops the caller return");
  assert.deepEqual(m.calls, [], "leaf makes no calls");
  assert.equal(m.regs.a, 0x05, "A holds the isolated nibble");
  assert.equal(m.regs.c, 0x00, "a digit clears the blank budget");
  assert.equal(m.mem.read8(0x8781), 0x05, "digit tile stored at (ix)");
  assert.equal(m.regs.ix, 0x8761, "ix stepped by DE=-0x20");
  assert.deepEqual(m.pcSeq, [0x059f, 0x05a1, 0x05a3, 0x05a6, 0x05a8, CALLER_RET], "non-zero boundaries");
});

// ── Path 2: zero nibble with C==0 -> store a real 0 ─────────────────────────────────────────────
test("loc_059d zero nibble, C==0: store real 0; 83 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0xa0; // low nibble 0
  m.regs.c = 0x00;
  m.regs.ix = 0x8781;
  m.regs.de = 0xffe0;

  loc_059d(m);

  assert.equal(m.tstates, 83, "zero-nibble-C0 own T total");
  assert.equal(m.pc, CALLER_RET, "ret returns to caller");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.equal(m.regs.a, 0x00, "A==C==0");
  assert.equal(m.mem.read8(0x8781), 0x00, "real zero tile stored");
  assert.equal(m.regs.ix, 0x8761, "ix stepped by DE");
  assert.deepEqual(m.pcSeq, [0x059f, 0x05a9, 0x05aa, 0x05ab, 0x05a3, 0x05a6, 0x05a8, CALLER_RET], "zero-C0 boundaries");
});

// ── Path 3: zero nibble with C>0 -> store blank tile 0x10 and consume one blank ─────────────────
test("loc_059d zero nibble, C>0: store blank 0x10, C--; 101 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x20; // low nibble 0
  m.regs.c = 0x04;
  m.regs.ix = 0x8781;
  m.regs.de = 0xffe0;

  loc_059d(m);

  assert.equal(m.tstates, 101, "zero-nibble-Cpos own T total");
  assert.equal(m.pc, CALLER_RET, "ret returns to caller");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.equal(m.regs.a, 0x10, "A holds the blank tile");
  assert.equal(m.regs.c, 0x03, "one blank consumed");
  assert.equal(m.mem.read8(0x8781), 0x10, "blank tile stored");
  assert.equal(m.regs.ix, 0x8761, "ix stepped by DE");
  assert.deepEqual(m.pcSeq,
    [0x059f, 0x05a9, 0x05aa, 0x05ab, 0x05ad, 0x05af, 0x05b0, 0x05a3, 0x05a6, 0x05a8, CALLER_RET],
    "zero-Cpos boundaries");
});

// ── MUTATION: mis-charging the store step (19T) is caught by the golden total ───────────────────
test("loc_059d MUTATION: a dropped `ld (ix+0),a` charge (19T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x35;
  m.regs.c = 0x04;
  m.regs.ix = 0x8781;
  m.regs.de = 0xffe0;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x05a6 ? 0 : c); // drop the store's 19T
  loc_059d(m);
  assert.equal(m.tstates, 46, "mutation drops 19 T");
  assert.notEqual(m.tstates, 65, "golden T total catches the dropped step");
});
