// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_04f2 (ROM 0x04f2, Pooyan) -- selects the active player's
 * 3-byte BCD score buffer into DE from bit0 of the mode byte 0x880d, preserving AF via a
 * push af / pop af pair. Self-contained mock machine (real Regs, flat 64K RAM,
 * step/call/ret/push16/pop16). A seated caller return proves the final `ret` and that the
 * push/pop balanced (SP restored, caller return still popped).
 *
 * Path P2 (bit0=1) exercises the ld de,0x88a5 branch; Path P1 (bit0=0) keeps 0x88a2. Both
 * assert AF is unchanged. TEETH: mis-charge `ld a,(0x880d)` (13 T) as 7 T -> the 75-T golden
 * must catch it.
 *
 * Run: node --test games/pooyan/translated/test/loc_04f2.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_04f2 } from "../loc_04f2.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x04f2, pcSeq: [],
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
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

const PC_P2 = [0x04f3, 0x04f6, 0x04f9, 0x04fa, 0x04fc, 0x04ff, 0x0500, CALLER_RET];

test("loc_04f2 Path P2: 0x880d bit0=1 -> DE=0x88a5, AF preserved", () => {
  const m = makeMachine();
  seatCaller(m);
  const spBeforeSeat = 0x8780; // seatCaller pushes one word below this
  m.regs.a = 0x77;
  m.regs.f = 0x00;
  m.mem.write8(0x880d, 0x01);

  loc_04f2(m);

  assert.equal(m.tstates, 75, "Path P2 T = 11+13+10+4+7+10+10+10");
  assert.deepEqual(m.pcSeq, PC_P2, "P2 step boundaries (ld de,0x88a5 branch)");
  assert.equal(m.pc, CALLER_RET, "ends via ret to the seated caller");
  assert.equal(m.regs.de, 0x88a5, "player-2 score buffer");
  assert.equal(m.regs.a, 0x77, "A restored by pop af");
  assert.equal(m.regs.f, 0x00, "F restored by pop af");
  assert.equal(m.regs.sp, spBeforeSeat, "push af / pop af balanced; ret popped the caller return");
  assert.deepEqual(m.calls, [], "no calls");
});

test("loc_04f2 Path P1: 0x880d bit0=0 -> DE=0x88a2", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x77;
  m.mem.write8(0x880d, 0x00);

  loc_04f2(m);

  assert.equal(m.tstates, 70, "Path P1 T = 11+13+10+4+12+10+10 (jr nc taken)");
  assert.deepEqual(m.pcSeq, [0x04f3, 0x04f6, 0x04f9, 0x04fa, 0x04ff, 0x0500, CALLER_RET]);
  assert.equal(m.regs.de, 0x88a2, "player-1 score buffer");
  assert.equal(m.regs.a, 0x77, "A restored by pop af");
});

test("loc_04f2 MUTATION: `ld a,(0x880d)` mis-charged 7T (not 13T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x04f6 ? 7 : cycles);
  seatCaller(m);
  m.regs.a = 0x77;
  m.mem.write8(0x880d, 0x01);

  loc_04f2(m);

  assert.equal(m.tstates, 69, "mutation loses 6 T (13 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, 75, "Path P2 T"),
    /75/,
    "the 75-T golden must fail on the mutant",
  );
});
