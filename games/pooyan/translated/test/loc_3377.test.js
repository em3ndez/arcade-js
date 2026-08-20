// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_3377 (ROM 0x3377, Pooyan) -- the 0x0e-record sweep over IX=0x8ae0
 * (stride 0x18), parking B/DE in the alt register set (exx) across loc_338a.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling loc_338a's `ret`), so a
 * missing push16 in the loop body desyncs SP: every iteration's call then over-pops and the final ret
 * misses CALLER_RET. The exx pair is balanced so B (the loop counter) survives the call.
 *
 * Full run: 14 iterations, IX advances 0x8ae0 -> 0x8c30, T=778, full pcSeq built from the loop shape.
 * TEETH: mis-charge `add ix,de` (15 T) as 11 T -> loses 4 T per iteration (56 total).
 *
 * Run: node --test games/pooyan/translated/test/loc_3377.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_3377 } from "../loc_3377.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x3377, pcSeq: [],
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
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

function expectedSeq() {
  const seq = [0x337b, 0x337e, 0x3380];
  for (let i = 0; i < 14; i++) {
    seq.push(0x3381, 0x338a, 0x3385, 0x3387);
    seq.push(i < 13 ? 0x3380 : 0x3389);
  }
  seq.push(CALLER_RET);
  return seq;
}

test("loc_3377 full sweep: 14 records, IX 0x8ae0 -> 0x8c30, ret", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_3377(m);

  assert.equal(m.tstates, 778, "T = setup 31 + 13*(40+13) + (40+8) + ret 10");
  assert.deepEqual(m.pcSeq, expectedSeq(), "step boundaries match the loop shape");
  assert.equal(m.calls.length, 14, "loc_338a called once per record");
  assert.ok(m.calls.every((a) => a === 0x338a), "every call is loc_338a");
  assert.equal(m.regs.ix, 0x8c30, "IX advanced by 14 * 0x18");
  assert.equal(m.regs.b, 0x00, "B counted down to 0");
  assert.equal(m.regs.de, 0x0018, "DE stride restored by the closing exx");
  assert.equal(m.pc, CALLER_RET, "ret to the seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound (14 push16 each matched a callee ret)");
});

test("loc_3377 MUTATION: `add ix,de` mis-charged 11T (not 15T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x3387 ? 11 : cycles);
  seatCaller(m);

  loc_3377(m);

  assert.equal(m.tstates, 722, "mutation loses 4 T * 14 iterations");
  assert.throws(
    () => assert.equal(m.tstates, 778, "full-sweep T-state total"),
    /778/,
    "the 778-T golden must fail on the mutant",
  );
});
