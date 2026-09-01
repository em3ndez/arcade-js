// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_09d6 (ROM 0x09d6-0x09ee): clear play-field video RAM from 0x2402, skip
// the 6-byte column gap whenever (L & 0x1f) >= 0x1c, loop until H==0x40. Goldens (5824 iterations,
// 388884 T, final HL=0x4002, last write 0x3ffb) come from an independent reference sim of the ROM
// semantics -- NOT from this routine. RAM is pre-filled 0xAA so cleared cells are distinguishable.
//
// Run: node --test games/invaders/translated/test/loc_09d6.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_09d6 } from "../loc_09d6.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  ram.fill(0xaa);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x2000; m.push16(CALLER_RET); }

test("loc_09d6: clears 0x2402.. with the gap skip; 5824 cells, 388884 T", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_09d6(m);

  assert.equal(m.regs.hl, 0x4002, "HL walked to 0x4002 (H reached 0x40)");
  assert.equal(m.pc, CALLER_RET, "final ret to caller");
  assert.deepEqual(m.calls, [], "no calls");
  assert.equal(m.tstates, 388884, "independent reference T-state total");

  // cleared cells (written 0x00) vs skipped cells (still 0xaa)
  assert.equal(m.ram[0x2402], 0x00, "first cell cleared");
  assert.equal(m.ram[0x241b], 0x00, "last cell before the first gap cleared");
  assert.equal(m.ram[0x241c], 0xaa, "gap start skipped");
  assert.equal(m.ram[0x2422], 0x00, "first cell after the gap cleared");
  assert.equal(m.ram[0x3ffb], 0x00, "last cleared cell");
  assert.equal(m.ram[0x3fff], 0xaa, "tail past the last write untouched");
  assert.equal(m.ram[0x2400], 0xaa, "0x2400/0x2401 untouched (loop starts at 0x2402)");

  let cleared = 0;
  for (let a = 0x2402; a < 0x4002; a++) if (m.ram[a] === 0x00) cleared++;
  assert.equal(cleared, 5824, "exactly 5824 cells cleared in [0x2402,0x4002)");
});

test("loc_09d6 MUTATION: the loop-exit `jc` mis-charged 7T (not 10T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x09ee ? 7 : c); // exit step happens exactly once
  loc_09d6(m);
  assert.equal(m.tstates, 388881, "mutation loses 3 T");
  assert.notEqual(m.tstates, 388884, "golden T-state total catches the mutant");
});
