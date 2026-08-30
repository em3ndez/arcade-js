// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_10a2 (Pooyan ROM 0x10a2) -- the HUD score/counter renderer for
 * the three work-RAM byte fields 0x8f5d / 0x8f5e / 0x8f60. Each field is optionally BCD-processed
 * via loc_1131 and painted via loc_1119; the last step bumps 0x8f5c and tail-calls loc_0f44.
 *
 * This routine MAKES calls, so (per loc_02ef) the mock's `call` pops the return the routine pushed
 * (simulating each leaf's own `ret`), keeping SP balanced so the final `ret` recovers the caller.
 *
 * Pinned paths:
 *   Path A -- all three fields zero: every < 0x0a / == 0 shortcut taken. Only the three "always"
 *     paints run (0x8650, 0x8652, 0x8f60-is-zero-skips-0x85d2), i.e. two 0x1119 paints + tail.
 *     Calls [0x1119, 0x1119, 0x0f44]. T = 228.
 *   Path B -- 0x8f5d=0x0a (>= 0x0a: BCD helper + the count-DOWN loop + second paint), 0x8f5e=5
 *     (< 0x0a: skip helper), 0x8f60=3 with C=2 (accumulate + latch C to 0x85f2 + paint). Exercises
 *     the first `call 0x1131`, the dec loop (3 iterations), sla, and every remaining branch.
 *     Calls [0x1131,0x1119,0x1131,0x1119,0x1119,0x1131,0x1119,0x0f44]. T = 526.
 *
 * TEETH: mis-charge `inc (hl)` at 0x1115 (11 T) as 7 T (as if a plain `inc r`) -- the golden 228
 * must catch it.
 *
 * Run: node --test games/pooyan/translated/test/loc_10a2.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_10a2 } from "../loc_10a2.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x10a2, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) {
      regs.sp = (regs.sp - 2) & 0xffff;
      mem.write8(regs.sp, v & 0xff);
      mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
    },
    pop16() {
      const lo = mem.read8(regs.sp);
      const hi = mem.read8((regs.sp + 1) & 0xffff);
      regs.sp = (regs.sp + 2) & 0xffff;
      return lo | (hi << 8);
    },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // A leaf callee runs and RETs, netting SP unchanged: record the target, pop the return address.
    call(addr) { this.calls.push(addr); regs.sp = (regs.sp + 2) & 0xffff; return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

// Each entry is where an instruction LANDS (call entries are the target, not the pushed return).
const EXPECTED_PC_SEQ_A = [
  0x10a5, 0x10a7, 0x10ad,               // ld a,(0x8f5d)=0; cp 0x0a; jr c (taken)
  0x10b0, 0x1119, 0x10b6, 0x10b7,       // ld hl,0x8650; call 0x1119; ld a,(0x8f5d); and a
  0x10df,                               // jr z,0x10df (taken)
  0x10e2, 0x10e4, 0x10ea,               // ld a,(0x8f5e)=0; cp 0x0a; jr c (taken)
  0x10ed, 0x1119, 0x10f3, 0x10f4, 0x10f5, // ld hl,0x8652; call 0x1119; ld hl,0x8f60; ld a,(hl); and a
  0x1111,                               // jr z,0x1111 (taken)
  0x1114, 0x1115, 0x0f44,               // ld hl,0x8f5c; inc (hl); call 0x0f44
  CALLER_RET,                           // ret
];

test("loc_10a2 Path A: all fields zero -> two paints + tail, all shortcuts taken", () => {
  const m = makeMachine();
  seatCaller(m);
  // 0x8f5d, 0x8f5e, 0x8f60 all default 0.
  loc_10a2(m);

  assert.equal(m.tstates, 228, "Path A T-state total");
  assert.deepEqual(m.pcSeq, EXPECTED_PC_SEQ_A, "step boundaries match the disassembly");
  assert.deepEqual(m.calls, [0x1119, 0x1119, 0x0f44], "two 0x1119 paints then the 0x0f44 tail");
  assert.equal(m.pc, CALLER_RET, "ends via ret (seated caller recovered)");
  assert.equal(m.regs.sp, 0x8780, "SP balanced back to the caller frame");
  assert.equal(m.mem.read8(0x8f5c), 0x01, "sub-state counter 0x8f5c bumped");
  assert.equal(m.mem.read8(0x8f62), 0x00, "0x8f62 untouched on the zero path");
});

const EXPECTED_PC_SEQ_B = [
  0x10a5, 0x10a7, 0x10a9, 0x10aa, 0x1131, // ld a,(0x8f5d)=0x0a; cp 0x0a (no C); jr c nt; ld b,a; call 0x1131
  0x10b0, 0x1119, 0x10b6, 0x10b7,         // ld hl,0x8650; call 0x1119; ld a,(0x8f5d); and a (nz)
  0x10b9, 0x10bb,                         // jr z nt; cp 0x0c
  0x10bd, 0x10bf, 0x10c1,                 // jr nc nt; sub 0x07 (=3); ld b,0x05
  0x10c3, 0x10cb,                         // jr z nt; jr nc (taken) -> dec loop
  0x10cc, 0x10cd, 0x10cb,                 // dec loop iter 1 (a: 3->2)
  0x10cc, 0x10cd, 0x10cb,                 // dec loop iter 2 (a: 2->1)
  0x10cc, 0x10cd, 0x10cf,                 // dec loop iter 3 (a: 1->0, exit)
  0x10d0,                                 // ld a,b (0x10cf)
  0x10d1, 0x10d4, 0x10d6, 0x1131, 0x10dc, 0x1119, // loc_10d0: ld a,b; ld (0x8f62),a; sla b; call 0x1131; ld hl,0x85d0; call 0x1119
  0x10e2, 0x10e4, 0x10ea,                 // ld a,(0x8f5e)=5; cp 0x0a (C); jr c (taken)
  0x10ed, 0x1119, 0x10f3, 0x10f4, 0x10f5, // ld hl,0x8652; call 0x1119; ld hl,0x8f60; ld a,(hl)=3; and a (nz)
  0x10f7, 0x10f8, 0x10fa, 0x10fb, 0x10fc, 0x10fe, 0x1131, // ld b,a; ld l,0x62; add a,(hl); ld (hl),a; sla b; call 0x1131
  0x1102, 0x1103, 0x1104,                 // ld e,a; ld a,c; and a (c=2 nz)
  0x1106, 0x1107, 0x110a,                 // jr z nt; ld a,c; ld (0x85f2),a
  0x110d, 0x110e, 0x1119,                 // loc_110a: ld hl,0x85d2; ld a,e; call 0x1119
  0x1114, 0x1115, 0x0f44,                 // ld hl,0x8f5c; inc (hl); call 0x0f44
  CALLER_RET,                             // ret
];

test("loc_10a2 Path B: 0x8f5d=0x0a exercises BCD helper + dec loop + all remaining branches", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f5d, 0x0a); // >= 0x0a: first call 0x1131; re-centre 0x0a-7=3 -> count DOWN
  m.mem.write8(0x8f5e, 0x05); // < 0x0a: skip its helper
  m.mem.write8(0x8f60, 0x03); // non-zero: accumulate + paint
  m.regs.c = 0x02; // C non-zero -> latch to 0x85f2 (the mock's call does not clobber C)
  loc_10a2(m);

  assert.equal(m.tstates, 526, "Path B T-state total");
  assert.deepEqual(m.pcSeq, EXPECTED_PC_SEQ_B, "step boundaries match the disassembly");
  assert.deepEqual(
    m.calls,
    [0x1131, 0x1119, 0x1131, 0x1119, 0x1119, 0x1131, 0x1119, 0x0f44],
    "three BCD helpers interleaved with four paints, then the tail",
  );
  assert.equal(m.pc, CALLER_RET, "ends via ret");
  assert.equal(m.regs.sp, 0x8780, "SP balanced (every call push popped by the leaf)");
  // dec loop from A=3,B=5: three iterations leave B=2, then loc_10d0 stashes it, doubles to 4.
  assert.equal(m.mem.read8(0x8f62), 0x05, "0x8f62 = re-centred 2, then + field 3 = 5");
  assert.equal(m.mem.read8(0x85f2), 0x02, "C latched to 0x85f2");
  assert.equal(m.mem.read8(0x8f5c), 0x01, "sub-state counter bumped");
  assert.equal(m.regs.e, 0x05, "E holds the last BCD digit A (value at 0x8f62 pre-doubling path)");
});

test("loc_10a2 MUTATION: `inc (hl)` at 0x1115 mis-charged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x1115 ? 7 : cycles);
  seatCaller(m);
  loc_10a2(m); // Path A inputs (all zero)

  assert.equal(m.tstates, 224, "mutation loses 4 T (11 -> 7)");
  assert.throws(() => assert.equal(m.tstates, 228, "Path A T-state total"), /T-state total/);
});
