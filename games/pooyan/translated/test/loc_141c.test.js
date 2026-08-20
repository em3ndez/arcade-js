// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_141c (ROM 0x141c, Pooyan) -- gate on (ix+6): >= 2 -> ret; else clear
 * (ix+8), DE=0x3829, tail jp 0x381e. The mock's `call` POPS (models the callee's ret).
 *
 * Paths: RET ((ix+6)=2 -> ret nc to CALLER_RET) and JP ((ix+6)=0 -> tail jp 0x381e). Stack teeth:
 * the ret path lands on the seated CALLER_RET; the tail-jp path's callee ret consumes CALLER_RET ->
 * SP back to baseline. TEETH: mis-charge `ld (ix+8),0x00` (19T) as 10T -> the 70-T golden throws.
 * Pure-tail routine (no push16), so the push16-deletion control is N/A -- the T-state mutation is the control.
 *
 * Run: node --test games/pooyan/translated/test/loc_141c.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_141c } from "../loc_141c.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x141c, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_141c Path RET: (ix+6) >= 2 -> ret nc immediately", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8b00;
  m.mem.write8(0x8b06, 0x02); // 2 >= 2 -> cp 0x02 no borrow -> carry clear -> ret nc taken

  loc_141c(m);

  assert.equal(m.tstates, 37, "Path RET T-state total");
  assert.deepEqual(m.pcSeq, [0x141f, 0x1421, CALLER_RET], "ld a,(ix+6); cp; ret nc -> caller");
  assert.equal(m.pc, CALLER_RET, "ret nc to the seated caller");
  assert.deepEqual(m.calls, []);
  assert.equal(m.mem.read8(0x8b08), 0x00, "(ix+8) untouched on the ret path");
  assert.equal(m.regs.sp, 0x8780, "ret popped CALLER_RET -> baseline");
});

test("loc_141c Path JP: (ix+6) < 2 -> clear (ix+8), DE=0x3829, tail jp 0x381e", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8b00;
  m.mem.write8(0x8b06, 0x00); // 0 < 2 -> borrow -> carry set -> ret nc NOT taken
  m.mem.write8(0x8b08, 0xff); // pre-seed to prove it gets cleared

  loc_141c(m);

  assert.equal(m.tstates, 70, "Path JP T-state total");
  assert.deepEqual(m.pcSeq, [0x141f, 0x1421, 0x1422, 0x1426, 0x1429, 0x381e], "fall through -> tail 0x381e");
  assert.equal(m.pc, 0x381e, "tail jp lands on 0x381e");
  assert.deepEqual(m.calls, [0x381e]);
  assert.equal(m.mem.read8(0x8b08), 0x00, "(ix+8) cleared");
  assert.equal(m.regs.de, 0x3829, "DE seated for loc_381e");
  assert.equal(m.regs.sp, 0x8780, "tail callee's ret consumed CALLER_RET -> baseline");
});

test("loc_141c MUTATION: `ld (ix+8),0x00` mis-charged 10T (not 19T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x1426 ? 10 : cycles);
  seatCaller(m);
  m.regs.ix = 0x8b00;
  m.mem.write8(0x8b06, 0x00);

  loc_141c(m);

  assert.equal(m.tstates, 61, "mutation loses 9 T (19 -> 10)");
  assert.throws(() => assert.equal(m.tstates, 70, "Path JP T-state total"), /70/, "the 70-T golden must fail on the mutant");
});
