// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for translated loc_5df7 (ROM 0x5df7, Pooyan) -- the gate + setup for the loc_5e11
 * proximity sweep. Three paths: ret nz on flag 0x8d32, ret nz on (0x8f08|0x8f24), and the full setup
 * that tail-delegates (fall-through) into loc_5e11.
 *
 * The mock's `call` POPS -- for the tail fall-through into loc_5e11 (no push16 at the site) that pop
 * models loc_5e11's `ret` consuming the seated CALLER_RET, so SP returns to the pre-seat baseline
 * (the tail-call stack tooth). loc_5df7 pushes nothing itself.
 *
 * Run: node --test games/pooyan/translated/test/loc_5df7.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5df7 } from "../loc_5df7.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x5df7, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // Tail fall-through into loc_5e11: no push16 at the site, so this pop consumes the seated
    // CALLER_RET (loc_5e11's ret returns past loc_5df7), unwinding SP to the pre-seat baseline.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_5df7 Path SETUP: flags clear -> seed registers + fall into loc_5e11", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d32, 0x00); // not yet triggered
  m.mem.write8(0x8f08, 0x00);
  m.mem.write8(0x8f24, 0x00);

  loc_5df7(m);

  assert.equal(m.tstates, 13 + 4 + 5 + 13 + 10 + 7 + 5 + 14 + 14 + 10 + 7, "setup path T total = 102");
  assert.deepEqual(m.pcSeq, [
    0x5dfa, 0x5dfb, 0x5dfc, 0x5dff, 0x5e02, 0x5e03,
    0x5e04, 0x5e08, 0x5e0c, 0x5e0f, 0x5e11,
  ], "both ret nz fall through, then setup steps into 0x5e11");
  assert.equal(m.pc, 0x5e11, "last step lands at the loc_5e11 entry");
  assert.deepEqual(m.calls, [0x5e11], "tail-delegates to loc_5e11");
  assert.equal(m.regs.sp, 0x8780, "tail: loc_5e11's ret consumed CALLER_RET -> SP at baseline");
  assert.equal(m.regs.ix, 0x8840, "IX source seeded");
  assert.equal(m.regs.iy, 0x887c, "IY target seeded");
  assert.equal(m.regs.hl, 0x8be8, "HL records seeded");
  assert.equal(m.regs.b, 0x03, "B = 3 slots");
});

test("loc_5df7 Path RET1: 0x8d32 already set -> ret nz immediately", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d32, 0x01);

  loc_5df7(m);

  assert.equal(m.tstates, 13 + 4 + 11, "ld a + and a + ret nz taken");
  assert.deepEqual(m.pcSeq, [0x5dfa, 0x5dfb, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [], "no setup, no delegate");
  assert.equal(m.regs.sp, 0x8780, "ret unwound the seated caller");
});

test("loc_5df7 Path RET2: (0x8f08|0x8f24) non-zero -> ret nz at 0x5e03", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d32, 0x00);
  m.mem.write8(0x8f08, 0x04); // A term non-zero -> or stays non-zero
  m.mem.write8(0x8f24, 0x00);

  loc_5df7(m);

  assert.equal(m.tstates, 13 + 4 + 5 + 13 + 10 + 7 + 11, "through the second guard, ret nz = 63");
  assert.deepEqual(m.pcSeq, [0x5dfa, 0x5dfb, 0x5dfc, 0x5dff, 0x5e02, 0x5e03, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [], "guard tripped before setup");
  assert.equal(m.regs.hl, 0x8f24, "HL still the guard pointer (setup not reached)");
});

test("loc_5df7 MUTATION: `ld ix,0x8840` mis-charged 10T (not 14T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d32, 0x00);
  m.mem.write8(0x8f08, 0x00);
  m.mem.write8(0x8f24, 0x00);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x5e08 ? 10 : c); // ld ix,nn steps to 0x5e08

  loc_5df7(m);

  assert.equal(m.tstates, 102 - 4, "mutation loses 4 T (14 -> 10)");
  assert.throws(() => assert.equal(m.tstates, 102), /102/, "the golden must fail on the mutant");
});
