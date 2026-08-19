// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_0ee3 (ROM 0x0ee3-0x0ef0): conditional sound command 0x04. Enqueues via
// helper 0x0ea2 only when both gate flags (0x8f24, 0x8d32) are zero; a non-zero flag ret's early.
// Full mock (real Regs) with push16/pop16/ret so the early `ret nz` paths pop the seated caller
// return. The tail-jr is a boundary: the record-only `call` stub stops at the helper entry.
// Run: node --test games/pooyan/translated/test/loc_0ee3.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0ee3 } from "../loc_0ee3.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(c = 10) { this.step(this.pop16(), c); },
    call(a) { this.calls.push(a); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_0ee3 Path 1: (0x8f24)!=0 -> ret nz early; 28 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f24, 0x05);
  loc_0ee3(m);
  assert.equal(m.tstates, 28, "T = 13 + 4 + 11(ret nz taken)");
  assert.equal(m.pc, CALLER_RET, "ret nz returns to caller");
  assert.deepEqual(m.calls, [], "no enqueue when gate 0x8f24 is busy");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.deepEqual(m.pcSeq, [0x0ee6, 0x0ee7, CALLER_RET], "Path 1 boundaries");
});

test("loc_0ee3 Path 2: (0x8f24)==0, (0x8d32)!=0 -> ret nz early; 50 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f24, 0x00);
  m.mem.write8(0x8d32, 0x09);
  loc_0ee3(m);
  assert.equal(m.tstates, 50, "T = 13 + 4 + 5 + 13 + 4 + 11(ret nz taken)");
  assert.equal(m.pc, CALLER_RET, "ret nz returns to caller");
  assert.deepEqual(m.calls, [], "no enqueue when gate 0x8d32 is busy");
  assert.deepEqual(m.pcSeq, [0x0ee6, 0x0ee7, 0x0ee8, 0x0eeb, 0x0eec, CALLER_RET], "Path 2 boundaries");
});

test("loc_0ee3 Path 3: both gates 0 -> A=0x04, tail-jr into loc_0ea2; 63 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f24, 0x00);
  m.mem.write8(0x8d32, 0x00);
  loc_0ee3(m);
  assert.equal(m.tstates, 63, "T = 13 + 4 + 5 + 13 + 4 + 5 + 7 + 12(jr)");
  assert.equal(m.regs.a, 0x04, "A = 0x04 (sound command) handed to loc_0ea2");
  assert.equal(m.pc, 0x0ea2, "tail-jr lands at the delegate entry");
  assert.deepEqual(m.calls, [0x0ea2], "delegates to loc_0ea2");
  assert.deepEqual(m.pcSeq,
    [0x0ee6, 0x0ee7, 0x0ee8, 0x0eeb, 0x0eec, 0x0eed, 0x0eef, 0x0ea2], "Path 3 boundaries");
});

test("loc_0ee3 MUTATION: `ret nz` taken mis-charged 5T (as not-taken, not 11T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f24, 0x05);
  const realRet = m.ret.bind(m);
  m.ret = () => realRet(5);
  loc_0ee3(m);
  assert.equal(m.tstates, 22, "mutation loses 6 T (11 -> 5)");
  assert.notEqual(m.tstates, 28, "golden T-state total catches the mutant");
});
