// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_056b (ROM 0x056b-0x059c): the 3-byte BCD counter -> video column render.
// Flat-RAM mock (real Regs). The two per-row `call 0x059d` are pattern-A; the FAITHFUL stub runs
// m.ret(0) so each callee pops the return loc_056b pushed (a record-only stub would hide a leak).
// The selector in A (0/1/2) picks a different (source HL, dest IX) pair -- three prologue paths --
// then the B=3 loop issues 6 calls total. Golden own-T-state totals + SP balance + a positive
// control (a dropped push16 -> unbalanced SP) + a mis-charge mutation are the teeth.
//
// Run: node --test games/pooyan/translated/test/loc_056b.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_056b } from "../loc_056b.js";

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
    // FAITHFUL stub: 0x059d rets (0 T), popping the return loc_056b pushed for that call site.
    call(addr) { this.calls.push(addr); this.ret(0); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }
const SIX_CALLS = [0x059d, 0x059d, 0x059d, 0x059d, 0x059d, 0x059d];

// ── Selector 0: first `jr z` taken -> source 0x88a4 / dest 0x8781 ───────────────────────────────
test("loc_056b selector 0: 6 pattern-A calls, balanced; 318 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x00;

  loc_056b(m);

  assert.equal(m.tstates, 318, "selector-0 own T total");
  assert.equal(m.pc, CALLER_RET, "ret returns to loc_056b's caller");
  assert.equal(m.regs.sp, 0x8780, "stack balanced -- pattern-A calls do NOT leak");
  assert.deepEqual(m.calls, SIX_CALLS, "two calls per row x 3 rows");
  assert.equal(m.regs.hl, 0x88a1, "HL = 0x88a4 - 3 rows");
  assert.equal(m.regs.ix, 0x8781, "selector 0 dest (stub leaves ix untouched)");
  assert.equal(m.regs.b, 0x00, "loop ran B=3 down to 0");
  assert.equal(m.regs.de, 0xffe0, "column step latched");
});

// ── Selector 1: second `jr z` (after dec a) taken -> source 0x88a7 / dest 0x8521 ────────────────
test("loc_056b selector 1: source 0x88a7 / dest 0x8521; 353 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x01;

  loc_056b(m);

  assert.equal(m.tstates, 353, "selector-1 own T total (extra prologue)");
  assert.equal(m.pc, CALLER_RET, "returns to caller");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.deepEqual(m.calls, SIX_CALLS, "6 calls");
  assert.equal(m.regs.hl, 0x88a4, "HL = 0x88a7 - 3");
  assert.equal(m.regs.ix, 0x8521, "selector 1 dest");
});

// ── Selector 2: both `jr z` fall through -> source 0x88aa / dest 0x8641 ─────────────────────────
test("loc_056b selector 2: source 0x88aa / dest 0x8641; 372 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x02;

  loc_056b(m);

  assert.equal(m.tstates, 372, "selector-2 own T total (both jr z fall through)");
  assert.equal(m.pc, CALLER_RET, "returns to caller");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.deepEqual(m.calls, SIX_CALLS, "6 calls");
  assert.equal(m.regs.hl, 0x88a7, "HL = 0x88aa - 3");
  assert.equal(m.regs.ix, 0x8641, "selector 2 dest");
});

// ── POSITIVE CONTROL: dropping the first call's push16 (pattern-B) leaves SP unbalanced ──────────
test("loc_056b POSITIVE CONTROL: a dropped push16 (pattern-B) drifts SP", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x00;
  let dropped = false;
  const realPush = m.push16.bind(m);
  m.push16 = (v) => { if (!dropped && v === 0x0595) { dropped = true; return; } return realPush(v); };

  loc_056b(m);

  assert.notEqual(m.regs.sp, 0x8780, "a missing push16 leaks -> SP drifts (the pattern-B defect)");
});

// ── MUTATION: mis-charging the unique `ld de,0xffe0` step (10T) is caught ────────────────────────
test("loc_056b MUTATION: a dropped `ld de,0xffe0` charge (10T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x00;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0589 ? 0 : c); // drop the ld de charge
  loc_056b(m);
  assert.equal(m.tstates, 308, "mutation drops 10 T");
  assert.notEqual(m.tstates, 318, "golden T total catches the dropped step");
});
