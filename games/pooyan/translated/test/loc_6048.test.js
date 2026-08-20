// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for translated loc_6048 (ROM 0x6048-0x6068, Pooyan). Entered via `call 0x6048`.
 * Selects IX by the I-reg zero test (0x8c90 when I==0 else 0x8ca8), gates on that block's byte 0
 * (ret if 0, ret if ==3), stores it to 0x8d44, arms IX/B/HL and falls through into loc_6069.
 *
 * The mock's `call` POPS (models the eventual callee `ret` consuming the seated CALLER_RET). loc_6048
 * has no internal pushing call -- its only m.call is the terminal fall-through into loc_6069 -- so after
 * that fall-through SP returns to the pre-seat baseline, exactly as the `ret z` exits do via m.ret.
 *
 * Paths: A (I==0, active, fall-through), B (I!=0 -> IX=0x8ca8, byte0==0 -> ret at 0x6059),
 * C (byte0==3 -> ret at 0x605c). TEETH: mis-charge `ld a,(ix+0)` (19 T) as 7 T -> golden fails.
 *
 * Run: node --test games/pooyan/translated/test/loc_6048.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6048 } from "../loc_6048.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x6048, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // The eventual callee `ret` pops the return address on the stack -- model that pop so the terminal
    // fall-through unwinds the seated CALLER_RET (a stray/missing seat then desyncs SP and fails the test).
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_6048 Path A: I==0 -> IX=0x8c90, byte0 active -> fall through into loc_6069", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.i = 0x00;                 // ld a,i -> A=0 -> and a Z -> jr z taken (keep IX=0x8c90)
  m.mem.write8(0x8c90, 0x02);      // block byte 0 = 2 (not 0, not 3)

  loc_6048(m);

  assert.equal(m.tstates, 123, "Path A T-state total");
  assert.deepEqual(m.pcSeq, [
    0x604c, 0x604e, 0x604f, 0x6055, 0x6058, 0x6059, 0x605a, 0x605c,
    0x605d, 0x6060, 0x6064, 0x6066, 0x6069,
  ]);
  assert.equal(m.pc, 0x6069, "last step lands on the loc_6069 entry");
  assert.deepEqual(m.calls, [0x6069], "tail-delegates to loc_6069");
  assert.equal(m.mem.read8(0x8d44), 0x02, "byte0 stored at 0x8d44");
  assert.equal(m.regs.ix, 0x8868, "IX armed to 0x8868");
  assert.equal(m.regs.b, 0x05, "B armed to 5");
  assert.equal(m.regs.hl, 0x8b70, "HL armed to 0x8b70");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline (fall-through callee ret consumes CALLER_RET)");
});

test("loc_6048 Path B: I!=0 -> IX=0x8ca8, byte0==0 -> ret at 0x6059", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.i = 0x01;                 // A=1 -> and a NZ -> jr z NOT taken -> IX=0x8ca8
  m.mem.write8(0x8ca8, 0x00);      // block byte 0 = 0 -> ret z

  loc_6048(m);

  assert.equal(m.tstates, 82, "Path B T-state total");
  assert.deepEqual(m.pcSeq, [0x604c, 0x604e, 0x604f, 0x6051, 0x6055, 0x6058, 0x6059, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET, "ret z returns to the seated caller");
  assert.deepEqual(m.calls, [], "no fall-through -- returned early");
  assert.equal(m.regs.ix, 0x8ca8, "IX selected the second block");
  assert.equal(m.mem.read8(0x8d44), 0x00, "0x8d44 untouched");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_6048 Path C: byte0==3 -> ret at 0x605c", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.i = 0x00;                 // jr z taken -> IX=0x8c90
  m.mem.write8(0x8c90, 0x03);      // byte0 = 3 -> not-zero at 0x6058, ret z at 0x605c

  loc_6048(m);

  assert.equal(m.tstates, 85, "Path C T-state total");
  assert.deepEqual(m.pcSeq, [0x604c, 0x604e, 0x604f, 0x6055, 0x6058, 0x6059, 0x605a, 0x605c, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET, "ret z at 0x605c to the seated caller");
  assert.deepEqual(m.calls, [], "no fall-through");
  assert.equal(m.mem.read8(0x8d44), 0x00, "0x8d44 untouched (returned before the store)");
});

test("loc_6048 MUTATION: `ld a,(ix+0)` mis-charged 7T (not 19T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.i = 0x00;
  m.mem.write8(0x8c90, 0x02);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x6058 ? 7 : c); // ld a,(ix+0) steps to 0x6058

  loc_6048(m);

  assert.equal(m.tstates, 111, "mutation loses 12 T (19 -> 7)");
  assert.throws(() => assert.equal(m.tstates, 123, "Path A T-state total"), /123/,
    "the 123-T golden must fail on the mutant");
});
