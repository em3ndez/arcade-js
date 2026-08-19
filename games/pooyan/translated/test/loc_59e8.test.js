// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_59e8 (ROM 0x59e8-0x5a05): the coinage-gated update chain.
// Flat-RAM mock (real Regs). The five sub-updates are pattern-A calls and the tail `jp 0x5ac0`
// is a delegate, so the stub is FAITHFUL: each callee runs m.ret() (0 T, so tstates stays the
// routine's own count), popping the return loc_59e8 pushed. A record-only stub would hide an
// unbalanced call site, so the SP-balance assertion + positive control below are the teeth.
//
// Run: node --test games/pooyan/translated/test/loc_59e8.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_59e8 } from "../loc_59e8.js";

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
    // FAITHFUL stub: every callee returns via ret (0 T -> tstates counts only loc_59e8's own steps).
    // A pattern-A callee pops the return loc_59e8 pushed; the tail 0x5ac0 pops loc_59e8's caller return.
    call(addr) { this.calls.push(addr); this.ret(0); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

// ── Full path: neither coinage nibble is 0x0f -> run the chain, tail-jump into 0x5ac0 ──────────
test("loc_59e8 full path: five pattern-A calls + tail 0x5ac0 -> caller; balanced; 145 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x882c, 0x05);
  m.mem.write8(0x882f, 0x03);

  loc_59e8(m);

  assert.equal(m.tstates, 145, "full-path own T-state total");
  assert.equal(m.pc, CALLER_RET, "tail 0x5ac0's ret returns to loc_59e8's caller");
  assert.equal(m.regs.sp, 0x8780, "stack balanced -- pattern-A calls do NOT leak");
  assert.deepEqual(m.calls, [0x5a06, 0x5a56, 0x5a1f, 0x5a9c, 0x7e6d, 0x5ac0],
    "five sub-updates then the tail dispatch");
  assert.deepEqual(m.pcSeq,
    [0x59eb, 0x59ed, 0x59ee, 0x59f1, 0x59f3, 0x59f4,
      0x5a06, 0x59f7, 0x5a56, 0x59fa, 0x5a1f, 0x59fd, 0x5a9c, 0x5a00, 0x7e6d, 0x5a03,
      0x5ac0, CALLER_RET],
    "full-path boundaries: each call steps to the target, its ret pops the pushed return");
});

// ── POSITIVE CONTROL: the pattern-B bug (a missing push16 before a call) leaks 2 bytes. ─────────
// Swallow the first call's pushed return so 0x5a06's faithful ret pops something it should not --
// exactly what the old `m.call(0x5a06); m.step(0x59f7)` (no push) did. The stack MUST end unbalanced.
test("loc_59e8 POSITIVE CONTROL: dropping a call's push16 (pattern-B) leaves SP unbalanced", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x882c, 0x05);
  m.mem.write8(0x882f, 0x03);
  let dropped = false;
  const realPush = m.push16.bind(m);
  m.push16 = (v) => { if (!dropped && v === 0x59f7) { dropped = true; return; } return realPush(v); };

  loc_59e8(m);

  assert.notEqual(m.regs.sp, 0x8780, "a missing push16 leaks -> SP drifts (the pattern-B defect)");
});

// ── Early exit A: (0x882c) == 0x0f -> ret before reading the second nibble ─────────────────────
test("loc_59e8 early A: (0x882c)==0x0f -> ret z; 31 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x882c, 0x0f);

  loc_59e8(m);

  assert.equal(m.tstates, 31, "early-A T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret z");
  assert.deepEqual(m.calls, [], "no sub-updates run");
  assert.equal(m.regs.sp, 0x8780, "caller popped");
  assert.deepEqual(m.pcSeq, [0x59eb, 0x59ed, CALLER_RET], "early-A boundaries");
});

// ── Early exit B: first nibble passes, (0x882f) == 0x0f -> ret ─────────────────────────────────
test("loc_59e8 early B: (0x882f)==0x0f -> ret z; 56 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x882c, 0x05);
  m.mem.write8(0x882f, 0x0f);

  loc_59e8(m);

  assert.equal(m.tstates, 56, "early-B T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret z");
  assert.deepEqual(m.calls, [], "no sub-updates run");
  assert.deepEqual(m.pcSeq, [0x59eb, 0x59ed, 0x59ee, 0x59f1, 0x59f3, CALLER_RET], "early-B boundaries");
});

test("loc_59e8 MUTATION: a dropped `call 0x5a56` step (17T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x882c, 0x05);
  m.mem.write8(0x882f, 0x03);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x5a56 ? 0 : c); // drop the call-0x5a56 charge
  loc_59e8(m);
  assert.equal(m.tstates, 128, "mutation drops 17 T");
  assert.notEqual(m.tstates, 145, "golden T-state total catches the dropped step");
});
