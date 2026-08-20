// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_0496 (ROM 0x0496, Pooyan) -- the score-credit + high-score
 * update handler. Gated on 0x8806 bit0; index A picks a 3-byte BCD increment from table 0x0501
 * (A==0 -> the per-frame increment at 0x88ab), BCD-adds it into the player's counter, re-renders
 * (loc_056b), then compares the new value against the high score and copies it up if higher.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling the callee's `ret`), then
 * models loc_04f2's net effect (DE <- 0x88a2/0x88a5 per 0x880d bit0, AF kept); loc_056b only clobbers
 * regs loc_0496 reloads. Because the mock pops, a call site that forgot its `push16` desyncs the stack
 * (DE gets a stray value, the final pop16 misses CALLER_RET) -- so the balance assertion has real teeth.
 * push de (0x04b7) / pop de (0x04c3) frame the render and stay balanced across the call.
 *
 * Path HI (index 1, new > high score): BCD loop, compare hits jr nz on the first (MSB) byte,
 * copy loop, tail jp 0x056b. Full pcSeq + T=538. Path EQ (A==0 branch, new == high score):
 * the other loop entry (HL=0x88ab), compare runs all 3 bytes equal -> ret at 0x04d3.
 * TEETH: mis-charge `add hl,bc` (11 T) as 7 T -> the 538-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_0496.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0496 } from "../loc_0496.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x0496, pcSeq: [],
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
    // The callee's `ret` pops the return address loc_0496 pushed at the call site -- model that pop so
    // the stack stays balanced (a missing push16 at the call site then desyncs DE/SP and fails the test).
    // loc_04f2 additionally selects DE per 0x880d bit0 and preserves AF; loc_056b's clobbers are reloaded.
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      if (addr === 0x04f2) regs.de = (mem.read8(0x880d) & 1) ? 0x88a5 : 0x88a2;
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

const PC_HI = [
  0x0497, 0x049a, 0x049b, 0x049c, 0x049d, 0x049e, 0x04a0,
  0x04f2, 0x04a4, 0x04a5, 0x04a6, 0x04a8, 0x04ab, 0x04ac, 0x04ad, 0x04af, // call 0x04f2 -> target
  0x04b0, 0x04b1, 0x04b2, 0x04b3, 0x04b4, 0x04b5, 0x04af, // BCD iter1
  0x04b0, 0x04b1, 0x04b2, 0x04b3, 0x04b4, 0x04b5, 0x04af, // BCD iter2
  0x04b0, 0x04b1, 0x04b2, 0x04b3, 0x04b4, 0x04b5, 0x04b7, // BCD iter3
  0x04b8, 0x04bb, 0x04bc, 0x04c0, 0x056b, 0x04c4, 0x04c5, 0x04c8, 0x04ca, // call 0x056b -> target
  0x04cb, 0x04cc, 0x04cd, 0x04d4,                         // compare: jr nz on MSB
  0x04f2, 0x04da, 0x04dc,                                 // call 0x04f2 -> target
  0x04dd, 0x04de, 0x04df, 0x04e0, 0x04dc,                 // copy iter1
  0x04dd, 0x04de, 0x04df, 0x04e0, 0x04dc,                 // copy iter2
  0x04dd, 0x04de, 0x04df, 0x04e0, 0x04e2,                 // copy iter3
  0x04e4, 0x056b,
];

function setupHi(m) {
  seatCaller(m);
  m.regs.a = 0x01;             // index 1 (non-zero) -> table 0x0501 entry
  m.mem.write8(0x8806, 0x01);  // bit0 set -> gate open (ret nc not taken)
  m.mem.write8(0x880d, 0x00);  // player 1 -> DE=0x88a2; also bit0=0 for the 0x04bc jr nc
  // increment table[1] at 0x0501 + 3 = 0x0504 (real ROM bytes 10 00 00 -> +0x000010 BCD)
  m.mem.write8(0x0504, 0x10);
  m.mem.write8(0x0505, 0x00);
  m.mem.write8(0x0506, 0x00);
  // player-1 counter 0x88a2(lo) 0x88a3 0x88a4(hi)
  m.mem.write8(0x88a2, 0x00);
  m.mem.write8(0x88a3, 0x00);
  m.mem.write8(0x88a4, 0x50);
  // high score MSB below the new value -> triggers the update
  m.mem.write8(0x88aa, 0x40);
}

test("loc_0496 Path HI: index 1, new score beats high score -> copy + tail render", () => {
  const m = makeMachine();
  setupHi(m);

  loc_0496(m);

  assert.equal(m.tstates, 538, "Path HI T-state total");
  assert.deepEqual(m.pcSeq, PC_HI, "step boundaries match the ROM bytes");
  assert.equal(m.pc, 0x056b, "tail jp lands on 0x056b");
  assert.deepEqual(m.calls, [0x04f2, 0x056b, 0x04f2, 0x056b], "two loc_04f2 + two loc_056b");
  // BCD add: counter += 0x000010
  assert.equal(m.mem.read8(0x88a2), 0x10, "counter LSB after +0x10");
  assert.equal(m.mem.read8(0x88a3), 0x00, "counter mid");
  assert.equal(m.mem.read8(0x88a4), 0x50, "counter MSB unchanged (+0)");
  // high score copied from the counter (0x88a2..0x88a4 -> 0x88a8..0x88aa)
  assert.equal(m.mem.read8(0x88a8), 0x10, "high-score LSB copied");
  assert.equal(m.mem.read8(0x88a9), 0x00, "high-score mid copied");
  assert.equal(m.mem.read8(0x88aa), 0x50, "high-score MSB updated (was 0x40)");
  assert.equal(m.regs.a, 0x02, "selector 2 for the high-score re-render");
  // Tail `jp 0x056b`: loc_056b's ret pops the seated CALLER_RET (loc_0496 returns via the tail call),
  // so the stack fully unwinds to the pre-seat baseline. A call site missing its push16 would leave SP
  // off by 2 here -- this is the stack-fidelity tooth.
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline (every push16 matched a callee ret)");
});

test("loc_0496 Path EQ: A==0 branch, new == high score -> ret at 0x04d3", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x00;             // A==0 -> jr z to 0x04e7 (per-frame increment path)
  m.mem.write8(0x8806, 0x01);  // gate open
  m.mem.write8(0x880d, 0x00);  // DE=0x88a2; jr nc taken at 0x04bc
  // per-frame increment at 0x88ab..0x88ad = 0 -> counter unchanged
  m.mem.write8(0x88ab, 0x00);
  m.mem.write8(0x88ac, 0x00);
  m.mem.write8(0x88ad, 0x00);
  // counter and high score both zero -> compare is equal on all 3 bytes
  for (const a of [0x88a2, 0x88a3, 0x88a4, 0x88a8, 0x88a9, 0x88aa]) m.mem.write8(a, 0x00);

  loc_0496(m);

  assert.equal(m.tstates, 489, "Path EQ T-state total");
  assert.deepEqual(m.pcSeq, [
    0x0497, 0x049a, 0x049b, 0x049c, 0x049d, 0x049e, 0x04e7,
    0x04f2, 0x04ed, 0x04ee, 0x04f0, 0x04af, // call 0x04f2 -> target
    0x04b0, 0x04b1, 0x04b2, 0x04b3, 0x04b4, 0x04b5, 0x04af,
    0x04b0, 0x04b1, 0x04b2, 0x04b3, 0x04b4, 0x04b5, 0x04af,
    0x04b0, 0x04b1, 0x04b2, 0x04b3, 0x04b4, 0x04b5, 0x04b7,
    0x04b8, 0x04bb, 0x04bc, 0x04c0, 0x056b, 0x04c4, 0x04c5, 0x04c8, 0x04ca, // call 0x056b -> target
    0x04cb, 0x04cc, 0x04cd, 0x04cf, 0x04d0, 0x04d1, 0x04ca, // compare iter1 equal
    0x04cb, 0x04cc, 0x04cd, 0x04cf, 0x04d0, 0x04d1, 0x04ca, // compare iter2 equal
    0x04cb, 0x04cc, 0x04cd, 0x04cf, 0x04d0, 0x04d1, 0x04d3, // compare iter3 equal -> djnz falls out
    CALLER_RET,
  ], "A==0 loop entry (HL=0x88ab); all-equal compare returns at 0x04d3");
  assert.equal(m.pc, CALLER_RET, "ret at 0x04d3 to the seated caller");
  assert.deepEqual(m.calls, [0x04f2, 0x056b], "no second loc_04f2/loc_056b -- high score not updated");
  assert.equal(m.mem.read8(0x88a2), 0x00, "counter unchanged");
  assert.equal(m.mem.read8(0x88a8), 0x00, "high score untouched");
});

test("loc_0496 gate: 0x8806 bit0 clear -> ret nc immediately", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x01;
  m.mem.write8(0x8806, 0x00); // bit0 clear -> rrca carry clear -> ret nc

  loc_0496(m);

  assert.equal(m.tstates, 4 + 13 + 4 + 11, "T = ld c,a + ld a + rrca + ret nc");
  assert.deepEqual(m.pcSeq, [0x0497, 0x049a, 0x049b, CALLER_RET]);
  assert.deepEqual(m.calls, [], "no work done");
});

test("loc_0496 MUTATION: `add hl,bc` mis-charged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x04ac ? 7 : cycles);
  setupHi(m);

  loc_0496(m);

  assert.equal(m.tstates, 534, "mutation loses 4 T (11 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, 538, "Path HI T-state total"),
    /538/,
    "the 538-T golden must fail on the mutant",
  );
});
