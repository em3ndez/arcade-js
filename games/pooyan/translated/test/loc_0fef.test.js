// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_0fef (ROM 0x0fef-0x1034, Pooyan) -- main-loop sub-state 0 handler.
// Writes 0x0f to 0x8901; conditionally runs 0x50f1 (bit 2 of (0x8907)); re-arms 0x8f61/0x8f3f/
// 0x8f5c; calls setup 0x0fbc; reads pending sub-state (0x8a38): 0 => `ret z`, else stores it and
// FALLS THROUGH into loc_1016's per-frame worker chain, then `ret`s.
//
// Callees are plain-ret (pattern-A): the mock's call() runs m.ret() to pop each seated return, so
// the stack is exercised for real (a record-only stub would hide a push/pop imbalance). Each call
// therefore charges 17 (call) + 10 (callee ret) = 27 T and contributes [target, returnAddr] to pcSeq.
//
// Pinned paths:
//   A -- bit 2 clear (jr z taken, skip 0x50f1) and (0x8a38)=0 (ret z): early return.
//        T = 7+10+7+7+12+12(jr taken)+7+13+13+13+27(call 0fbc)+10+7+6+4+11(ret z taken) = 166.
//   B -- bit 2 set (call 0x50f1) and (0x8a38)=0x03: full fall-through into the 10-call chain.
//        T = 7+10+7+7+12+7(jr nt)+27(50f1)+7+13+13+13+27(0fbc)+10+7+6+4+5(ret z nt)+13
//            +10*27(chain)+10(ret) = 475.
//
// TEETH: mis-charge `bit 2,(hl)` (12 T) as 8 T -- the golden T-state must catch it.
//
// Run: node --test games/pooyan/translated/test/loc_0fef.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0fef } from "../loc_0fef.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x0fef, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // plain-ret callee: pop the pattern-A return so the stack is exercised for real.
    call(addr, site) { this.calls.push(addr); this.site = site; this.ret(); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_0fef path A: bit 2 clear + (0x8a38)=0 -> skip 0x50f1, ret z early", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x00); // bit 2 clear -> jr z taken
  m.mem.write8(0x8a38, 0x00); // no pending sub-state -> ret z
  loc_0fef(m);

  assert.equal(m.tstates, 166, "T = 7+10+7+7+12+12+7+13+13+13+27+10+7+6+4+11");
  assert.deepEqual(m.pcSeq, [
    0x0ff1, 0x0ff4, 0x0ff5, 0x0ff7, 0x0ff9, 0x0ffe,
    0x1000, 0x1003, 0x1006, 0x1009, 0x0fbc, 0x100c,
    0x100f, 0x1010, 0x1011, 0x1012, CALLER_RET,
  ], "jr z skips 0x50f1; only 0x0fbc is called; ret z returns to caller");
  assert.deepEqual(m.calls, [0x0fbc], "only the setup helper 0x0fbc runs on the early-out path");
  assert.equal(m.mem.read8(0x8901), 0x0f, "(0x8901) = 0x0f");
  assert.equal(m.mem.read8(0x8f61), 0x01, "(0x8f61) re-armed to 1");
  assert.equal(m.mem.read8(0x8f3f), 0x01, "(0x8f3f) re-armed to 1");
  assert.equal(m.mem.read8(0x8f5c), 0x01, "(0x8f5c) re-armed to 1 (no pending byte to overwrite it)");
  assert.equal(m.regs.a, 0x00, "A = pending byte (0)");
  assert.equal(m.regs.hl, 0x8a39, "HL advanced past (0x8a38)");
  assert.equal(m.regs.sp, 0x8780, "stack balanced (1 pattern-A call + ret z)");
  assert.equal(m.pc, CALLER_RET, "returned to caller");
});

test("loc_0fef path B: bit 2 set + (0x8a38)=0x03 -> call 0x50f1, fall through worker chain", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x04); // bit 2 set -> jr z NOT taken -> call 0x50f1
  m.mem.write8(0x8a38, 0x03); // pending sub-state -> store + fall through
  loc_0fef(m);

  assert.equal(m.tstates, 475,
    "T = 7+10+7+7+12+7+27+7+13+13+13+27+10+7+6+4+5+13 + 10*27 + 10");
  assert.deepEqual(m.pcSeq, [
    0x0ff1, 0x0ff4, 0x0ff5, 0x0ff7, 0x0ff9, 0x0ffb, 0x50f1, 0x0ffe,
    0x1000, 0x1003, 0x1006, 0x1009, 0x0fbc, 0x100c,
    0x100f, 0x1010, 0x1011, 0x1012, 0x1013, 0x1016,
    0x1583, 0x1019, 0x1042, 0x101c, 0x107d, 0x101f, 0x20d4, 0x1022,
    0x511b, 0x1025, 0x1219, 0x1028, 0x40bd, 0x102b, 0x02ef, 0x102e,
    0x5ae4, 0x1031, 0x0e64, 0x1034, CALLER_RET,
  ], "not-taken jr -> 0x50f1, then the full 10-call chain, then ret");
  assert.deepEqual(m.calls, [
    0x50f1, 0x0fbc, 0x1583, 0x1042, 0x107d, 0x20d4, 0x511b,
    0x1219, 0x40bd, 0x02ef, 0x5ae4, 0x0e64,
  ], "conditional 0x50f1 + setup + 10 worker-chain calls");
  assert.equal(m.mem.read8(0x8f5c), 0x03, "(0x8f5c) overwritten by the pending sub-state byte");
  assert.equal(m.regs.a, 0x03, "A = pending byte (0x03)");
  assert.equal(m.regs.sp, 0x8780, "stack balanced (12 pattern-A calls + final ret)");
  assert.equal(m.pc, CALLER_RET, "returned to caller");
});

test("loc_0fef MUTATION: `bit 2,(hl)` mis-charged 8T (not 12T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x0ff9 ? 8 : cycles);
  seatCaller(m);
  m.mem.write8(0x8907, 0x04);
  m.mem.write8(0x8a38, 0x03);
  loc_0fef(m);

  assert.equal(m.tstates, 471, "mutation loses 4 T (12 -> 8)");
});
