// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_3553 (ROM 0x3553, Pooyan) -- blank the actor sprite band.
 * A=0, HL=IX via push ix/pop hl, then rst 0x10 (loc_0010) fills B=0x17 bytes.
 *
 * The mock's `call` POPS the return address the rst pushed (modelling loc_0010's `ret`), so a missing
 * push16 before the rst desyncs the stack and the final ret lands on the wrong pc.
 * TEETH: mis-charge `push ix` (15 T) as 11 T -> the 57-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_3553.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_3553 } from "../loc_3553.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x3553, pcSeq: [],
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
    // The callee's `ret` pops the return address the call site pushed -- model that pop so the stack
    // stays balanced (a missing push16 then desyncs SP and the final ret lands off the seated caller).
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_3553: HL=IX, rst 0x10 fill, ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8abc;

  loc_3553(m);

  assert.equal(m.tstates, 57, "T = xor+push ix+pop hl+ld b+rst+ret");
  assert.deepEqual(m.pcSeq, [0x3554, 0x3556, 0x3557, 0x3559, 0x0010, CALLER_RET]);
  assert.deepEqual(m.calls, [0x0010], "rst 0x10 -> loc_0010");
  assert.equal(m.regs.hl, 0x8abc, "HL = IX (push ix / pop hl)");
  assert.equal(m.regs.a, 0x00, "A cleared by xor a");
  assert.equal(m.regs.b, 0x17, "B = fill count");
  assert.equal(m.pc, CALLER_RET, "ret to the seated caller");
  // Stack tooth: push ix / pop hl balance, rst push16 matched by loc_0010's ret pop, final ret pops
  // the seated CALLER_RET -> SP fully unwinds. A missing push16 before the rst breaks this.
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
});

test("loc_3553 MUTATION: `push ix` mis-charged 11T (not 15T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x3556 ? 11 : cycles);
  seatCaller(m);
  m.regs.ix = 0x8abc;

  loc_3553(m);

  assert.equal(m.tstates, 53, "mutation loses 4 T (15 -> 11)");
  assert.throws(
    () => assert.equal(m.tstates, 57, "T golden"),
    /57/,
    "the 57-T golden must fail on the mutant",
  );
});
