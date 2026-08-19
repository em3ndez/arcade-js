// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_0e64 (ROM 0x0e64-0x0e8e): consume one entry from the ring at page 0x8a
// whose head index is in (0x8a41). Empty slot (0xff) returns at once; otherwise, unless both gate
// flags ((0x8821)&1 and (0x8806)) are clear, dispatch the entry byte through loc_0e8f; then free the
// slot and advance the head index (0x43..0x5e wrap). loc_0e8f is stubbed to balance its pushed return.
//
// Run: node --test games/pooyan/translated/test/loc_0e64.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0e64 } from "../loc_0e64.js";

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
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(c = 10) { this.step(this.pop16(), c); },
    call(addr) { this.calls.push(addr); this.regs.sp = (this.regs.sp + 2) & 0xffff; return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_0e64 empty slot: (0x8a41)->0xff -> ret z, no work; 53 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8a41, 0x50);
  m.mem.write8(0x8a50, 0xff);

  loc_0e64(m);

  assert.equal(m.tstates, 53, "empty-slot T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret z");
  assert.deepEqual(m.calls, [], "no dispatch");
  assert.equal(m.mem.read8(0x8a41), 0x50, "head index untouched");
  assert.deepEqual(m.pcSeq, [0x0e67, 0x0e68, 0x0e69, 0x0e6b, 0x0e6c, 0x0e6e, CALLER_RET], "step boundaries");
});

function setupDispatchAdvance(m) {
  seatCaller(m);
  m.mem.write8(0x8a41, 0x50); // head index (!= 0x5e)
  m.mem.write8(0x8a50, 0x33); // entry byte
  m.mem.write8(0x8821, 0x01); // (0x8821)&1 set -> dispatch
}

function assertDispatchAdvance(m) {
  assert.equal(m.tstates, 153, "dispatch+advance T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.equal(m.regs.sp, 0x8780, "call push balanced");
  assert.deepEqual(m.calls, [0x0e8f], "entry dispatched through loc_0e8f");
  assert.equal(m.regs.b, 0x33, "B kept the entry byte");
  assert.equal(m.mem.read8(0x8a50), 0xff, "slot freed");
  assert.equal(m.mem.read8(0x8a41), 0x51, "head advanced 0x50 -> 0x51");
}

test("loc_0e64 dispatch + advance: flag set -> call 0x0e8f, free, inc head; 153 T", () => {
  const m = makeMachine();
  setupDispatchAdvance(m);
  loc_0e64(m);
  assertDispatchAdvance(m);
  assert.deepEqual(m.pcSeq,
    [0x0e67, 0x0e68, 0x0e69, 0x0e6b, 0x0e6c, 0x0e6e, 0x0e6f, 0x0e70, 0x0e73, 0x0e75,
     0x0e7d, 0x0e7e, 0x0e8f, 0x0e83, 0x0e84, 0x0e86, 0x0e88, 0x0e89, 0x0e8a, CALLER_RET],
    "step boundaries");
});

test("loc_0e64 suppress: both flags clear -> skip loc_0e8f, still free+advance; 156 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8a41, 0x50);
  m.mem.write8(0x8a50, 0x33);
  m.mem.write8(0x8821, 0x00); // (0x8821)&1 clear
  m.mem.write8(0x8806, 0x00); // and (0x8806) clear -> suppress

  loc_0e64(m);

  assert.equal(m.tstates, 156, "suppress-path T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.deepEqual(m.calls, [], "dispatch suppressed");
  assert.equal(m.mem.read8(0x8a50), 0xff, "slot freed even when suppressed");
  assert.equal(m.mem.read8(0x8a41), 0x51, "head advanced");
  assert.deepEqual(m.pcSeq,
    [0x0e67, 0x0e68, 0x0e69, 0x0e6b, 0x0e6c, 0x0e6e, 0x0e6f, 0x0e70, 0x0e73, 0x0e75,
     0x0e77, 0x0e7a, 0x0e7b, 0x0e81, 0x0e83, 0x0e84, 0x0e86, 0x0e88, 0x0e89, 0x0e8a, CALLER_RET],
    "step boundaries");
});

test("loc_0e64 wrap: head at 0x5e -> reset to 0x43; 161 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8a41, 0x5e); // head at top
  m.mem.write8(0x8a5e, 0x33);
  m.mem.write8(0x8821, 0x01); // dispatch

  loc_0e64(m);

  assert.equal(m.tstates, 161, "wrap-path T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.deepEqual(m.calls, [0x0e8f], "dispatched");
  assert.equal(m.mem.read8(0x8a5e), 0xff, "slot freed");
  assert.equal(m.mem.read8(0x8a41), 0x43, "head wrapped 0x5e -> 0x43");
  assert.deepEqual(m.pcSeq,
    [0x0e67, 0x0e68, 0x0e69, 0x0e6b, 0x0e6c, 0x0e6e, 0x0e6f, 0x0e70, 0x0e73, 0x0e75,
     0x0e7d, 0x0e7e, 0x0e8f, 0x0e83, 0x0e84, 0x0e86, 0x0e8b, 0x0e8d, 0x0e8e, CALLER_RET],
    "step boundaries");
});

test("loc_0e64 MUTATION: `call 0x0e8f` mis-charged 10T (not 17T) is caught", () => {
  const m = makeMachine();
  setupDispatchAdvance(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0e8f ? 10 : c);
  loc_0e64(m);
  assert.equal(m.tstates, 146, "mutation loses 7 T (17 -> 10)");
  assert.throws(() => assertDispatchAdvance(m), /dispatch\+advance T-state total/, "golden catches the mutant");
});
