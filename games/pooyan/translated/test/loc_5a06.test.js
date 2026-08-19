// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_5a06 (ROM 0x5a06-0x5a1e): the variant-A score-drip step.
// Self-contained mock (real Regs for exact flags, flat 64K RAM). A mid-body `call 0x0f09`
// pushes its return then delegates; the stub balances that push (SP += 2) for returning
// callees only, so a tail delegate (0x5a8c, no preceding push) stays record-only.
//
// Run: node --test games/pooyan/translated/test/loc_5a06.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5a06 } from "../loc_5a06.js";

const CALLER_RET = 0xabcd;
const RETURNING = new Set([0x0f09, 0x0038, 0x0010]); // callees that ret -> balance the pushed slot

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

// ── continue path: ring low-3 bits == 1 -> fire 0x0f09, A=1, tail to shared 0x5a8c ─────────────
test("loc_5a06 continue: bit2 set -> rl (0x8829)=1, fire 0x0f09, A=1, jp 0x5a8c; 110 T", () => {
  const m = makeMachine();
  const sp0 = seatCaller(m);
  m.mem.write8(0x8810, 0x04); // bit2 -> carry after 3 rrca
  m.mem.write8(0x8829, 0x00); // rl (hl) shifts carry in -> 0x01

  loc_5a06(m);

  assert.equal(m.tstates, 110, "loc_5a06 continue T-state total");
  assert.equal(m.pc, 0x5a8c, "tail-delegates to the shared accumulate entry");
  assert.deepEqual(m.calls, [0x0f09, 0x5a8c], "drip helper then shared tail");
  assert.equal(m.mem.read8(0x8829), 0x01, "(0x8829) ring got the carry bit");
  assert.equal(m.regs.a, 0x01, "A = 0x01 fed into the score tail");
  assert.equal(m.regs.sp, sp0, "0x0f09 push balanced; tail delegate left SP put");
  assert.deepEqual(m.pcSeq,
    [0x5a09, 0x5a0a, 0x5a0b, 0x5a0c, 0x5a0f, 0x5a11, 0x5a12, 0x5a14, 0x5a16, 0x5a17, 0x0f09, 0x5a1c, 0x5a8c],
    "step boundaries");
});

// ── ret nz path: ring low-3 bits != 1 -> straight back to the caller ───────────────────────────
test("loc_5a06 ret nz: ring != 1 -> ret to caller, no calls; 82 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8810, 0x00);
  m.mem.write8(0x8829, 0x00); // rl -> 0, and 0x07 -> 0, cp 1 -> nz

  loc_5a06(m);

  assert.equal(m.tstates, 82, "loc_5a06 ret nz T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret nz");
  assert.deepEqual(m.calls, [], "no drip, no tail");
  assert.equal(m.regs.sp, 0x8780, "ret popped the caller slot");
  assert.deepEqual(m.pcSeq,
    [0x5a09, 0x5a0a, 0x5a0b, 0x5a0c, 0x5a0f, 0x5a11, 0x5a12, 0x5a14, 0x5a16, CALLER_RET],
    "step boundaries");
});

// ── MUTATION: `rl (hl)` mis-charged 10T (not 15T) is caught by the golden total ─────────────────
test("loc_5a06 MUTATION: rl (hl) mis-charged 10T (not 15T)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8810, 0x04);
  m.mem.write8(0x8829, 0x00);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x5a11 ? 10 : c);
  loc_5a06(m);
  assert.equal(m.tstates, 105, "mutation loses 5 T (15 -> 10)");
  assert.notEqual(m.tstates, 110, "golden T-state total catches the mutant");
});
