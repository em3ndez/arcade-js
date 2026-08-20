// SPDX-License-Identifier: GPL-3.0-only
/**
 * Test for loc_0429 (ROM 0x0429-0x0438, Pooyan) -- the BCD byte splitter. Self-contained mock
 * machine (real Regs for exact flags, flat 64K RAM, step/call/ret/push16/pop16). No calls; the
 * mock seats a caller return so the final PC proves the `ret`. Path A: (ix)=0x37 -> writes low
 * nibble 7 to (hl), HL += DE, returns high nibble 3 (Z clear). Path B: (ix)=0x05 -> high nibble
 * 0 sets Z (the leading-zero signal). Golden 85 T computed from the Z80 timings.
 * TEETH: mis-charge `ld a,(ix+0)` (19 T) as 13 T; the 85-T golden must catch it.
 * Run: node --test games/pooyan/translated/test/loc_0429.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0429 } from "../loc_0429.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x0429, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); regs.sp = (regs.sp + 2) & 0xffff; return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

const PC_SEQ = [
  0x042c, 0x042d, 0x042f, 0x0430, 0x0431, 0x0432, 0x0433, 0x0434, 0x0435, 0x0436, 0x0438,
  CALLER_RET,
];

test("loc_0429 Path A: (ix)=0x37 -> low 7 stored, HL+=DE, high 3 in A (Z clear)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.regs.hl = 0x8500;
  m.regs.de = 0x0020;
  m.mem.write8(0x9000, 0x37);

  loc_0429(m);

  assert.equal(m.pc, CALLER_RET, "ends via ret");
  assert.equal(m.tstates, 85, "Path A T-state total");
  assert.deepEqual(m.calls, [], "no calls");
  assert.deepEqual(m.pcSeq, PC_SEQ, "step boundaries match the ROM bytes");
  assert.equal(m.mem.read8(0x8500), 0x07, "low nibble written to (hl)");
  assert.equal(m.regs.hl, 0x8520, "HL advanced by DE");
  assert.equal(m.regs.c, 0x37, "C keeps the whole byte");
  assert.equal(m.regs.a, 0x03, "A = high nibble");
  assert.equal(m.regs.fZ, false, "Z clear (high nibble != 0)");
});

test("loc_0429 Path B: (ix)=0x05 -> high nibble 0 sets Z", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.regs.hl = 0x8500;
  m.regs.de = 0x0020;
  m.mem.write8(0x9000, 0x05);

  loc_0429(m);

  assert.equal(m.tstates, 85, "Path B T-state total");
  assert.equal(m.mem.read8(0x8500), 0x05, "low nibble 5 written");
  assert.equal(m.regs.a, 0x00, "A = high nibble 0");
  assert.equal(m.regs.fZ, true, "Z set (high nibble == 0) -- the leading-zero signal");
});

test("loc_0429 MUTATION: `ld a,(ix+0)` mis-charged 13 T (not 19) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.regs.hl = 0x8500;
  m.regs.de = 0x0020;
  m.mem.write8(0x9000, 0x37);
  const real = m.step.bind(m);
  let first = true;
  m.step = (n, c) => { if (first && n === 0x042c) { first = false; return real(n, 13); } return real(n, c); };

  loc_0429(m);

  assert.equal(m.tstates, 79, "mutant lost exactly 6 T");
  assert.throws(() => assert.equal(m.tstates, 85, "Path A T-state total"), /Path A T-state total/);
});
