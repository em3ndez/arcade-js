// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_57c3 (ROM 0x57c3, Pooyan) -- 2-instr state-machine head:
 * `dec b; jr z,0x5835`. b==1 -> tail jp to loc_5835; any other b -> fall through into loc_57c6.
 * Both exits are TAIL transfers (no push16), so the callee's ret consumes the seated CALLER_RET
 * and SP unwinds to the pre-seat baseline. TEETH: mis-charge the taken `jr z` (12 T) as 7 T ->
 * the 16-T golden of the Z path throws.
 *
 * Run: node --test games/pooyan/translated/test/loc_57c3.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_57c3 } from "../loc_57c3.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x57c3, pcSeq: [],
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
    // Tail callee's ret pops the CALLER_RET this frame was seated with (loc_57c3 pushed nothing).
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_57c3 Z path: b==1 -> tail jp loc_5835", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.b = 0x01;

  loc_57c3(m);

  assert.equal(m.tstates, 4 + 12, "dec b + jr z taken = 16");
  assert.deepEqual(m.pcSeq, [0x57c4, 0x5835], "steps to the jr target loc_5835");
  assert.equal(m.pc, 0x5835);
  assert.deepEqual(m.calls, [0x5835]);
  assert.equal(m.regs.b, 0x00, "b decremented to 0");
  assert.equal(m.regs.sp, 0x8780, "tail: loc_5835's ret consumed the seated CALLER_RET");
});

test("loc_57c3 NZ path: b==5 -> fall through into loc_57c6", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.b = 0x05;

  loc_57c3(m);

  assert.equal(m.tstates, 4 + 7, "dec b + jr z not taken = 11");
  assert.deepEqual(m.pcSeq, [0x57c4, 0x57c6], "falls through to loc_57c6");
  assert.equal(m.pc, 0x57c6);
  assert.deepEqual(m.calls, [0x57c6]);
  assert.equal(m.regs.b, 0x04, "b decremented to 4");
  assert.equal(m.regs.sp, 0x8780, "tail: loc_57c6's ret consumed the seated CALLER_RET");
});

test("loc_57c3 wrap: b==0 -> dec to 0xff (NZ) -> loc_57c6", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.b = 0x00;

  loc_57c3(m);

  assert.deepEqual(m.pcSeq, [0x57c4, 0x57c6], "0 -> 0xff is non-zero, falls through");
  assert.equal(m.regs.b, 0xff, "b wraps to 0xff");
  assert.deepEqual(m.calls, [0x57c6]);
});

test("loc_57c3 MUTATION: taken `jr z` mis-charged 7T (not 12T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x5835 ? 7 : cycles);
  seatCaller(m);
  m.regs.b = 0x01;

  loc_57c3(m);

  assert.equal(m.tstates, 11, "mutation loses 5 T (12 -> 7)");
  assert.throws(() => assert.equal(m.tstates, 16, "Z path golden"), /16/);
});
