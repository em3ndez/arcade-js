// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_5c75 (ROM 0x5c75, Pooyan) -- the found-handler helper.
 * Stores DE into (iy+0x0c:0x0d) and clears (iy+0x0e); ret. Pure leaf, one straight-line path,
 * no calls.
 *
 * No push16-deletion positive control applies (there are no calls). The stack tooth is the ret:
 * it pops the seated CALLER_RET and SP unwinds to baseline. TEETH: mis-charge one `ld (iy+d),r`
 * (19 T) as 15 T -> the 67-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_5c75.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5c75 } from "../loc_5c75.js";

const CALLER_RET = 0xabcd;
const IY = 0x8d00;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x5c75, pcSeq: [],
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

const PC_MAIN = [0x5c78, 0x5c7b, 0x5c7f, CALLER_RET];

test("loc_5c75: store DE into (iy+0x0c:0x0d), clear (iy+0x0e), ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.iy = IY;
  m.regs.d = 0x12;
  m.regs.e = 0x34;

  loc_5c75(m);

  assert.equal(m.tstates, 67, "T-state total: 19 + 19 + 19 + ret 10");
  assert.deepEqual(m.pcSeq, PC_MAIN, "step boundaries match the ROM bytes");
  assert.equal(m.pc, CALLER_RET, "ret returns to the seated caller");
  assert.deepEqual(m.calls, [], "pure leaf, no calls");
  assert.equal(m.mem.read8(IY + 0x0c), 0x34, "(iy+0x0c) <- E");
  assert.equal(m.mem.read8(IY + 0x0d), 0x12, "(iy+0x0d) <- D");
  assert.equal(m.mem.read8(IY + 0x0e), 0x00, "(iy+0x0e) cleared");
  // ret pops the seated CALLER_RET -- the stack unwinds to baseline.
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
});

test("loc_5c75 MUTATION: `ld (iy+0x0c),e` mis-charged 15T (not 19T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x5c78 ? 15 : cycles);
  seatCaller(m);
  m.regs.iy = IY;
  m.regs.d = 0x12;
  m.regs.e = 0x34;

  loc_5c75(m);

  assert.equal(m.tstates, 63, "mutation loses 4 T (19 -> 15)");
  assert.throws(
    () => assert.equal(m.tstates, 67, "T-state total"),
    /67/,
    "the 67-T golden must fail on the mutant",
  );
});
