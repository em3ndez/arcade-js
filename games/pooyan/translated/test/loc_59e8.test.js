// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_59e8 (ROM 0x59e8-0x5a05): the coinage-gated update chain.
// Flat-RAM mock (real Regs). The five subroutine calls and the tail `jp 0x5ac0` are all record-only
// in the mock (regular call+ret is net-zero SP; the tail jp hands 0x5ac0 the caller's return), so no
// balancing stub is needed. The final PC distinguishes the two early `ret z` exits from the tail.
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
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

// ── Full path: neither coinage nibble is 0x0f -> run the chain, tail-jump into 0x5ac0 ──────────
test("loc_59e8 full path: five calls + tail jp 0x5ac0; 145 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x882c, 0x05);
  m.mem.write8(0x882f, 0x03);

  loc_59e8(m);

  assert.equal(m.tstates, 145, "full-path T-state total");
  assert.equal(m.pc, 0x5ac0, "tail-jumps into 0x5ac0 (no ret here)");
  assert.deepEqual(m.calls, [0x5a06, 0x5a56, 0x5a1f, 0x5a9c, 0x7e6d, 0x5ac0],
    "five sub-updates then the tail dispatch");
  assert.deepEqual(m.pcSeq,
    [0x59eb, 0x59ed, 0x59ee, 0x59f1, 0x59f3, 0x59f4, 0x59f7, 0x59fa, 0x59fd, 0x5a00, 0x5a03, 0x5ac0],
    "full-path boundaries");
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
  m.step = (n, c) => realStep(n, n === 0x59fa ? 0 : c); // drop the call-0x5a56 charge
  loc_59e8(m);
  assert.equal(m.tstates, 128, "mutation drops 17 T");
  assert.notEqual(m.tstates, 145, "golden T-state total catches the dropped step");
});
