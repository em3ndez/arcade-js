// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for translated loc_021a (ROM 0x021a): clears A (xra a), then falls through into
// loc_021b. Record-only mock pins the clear, T-states, step boundary, and the delegate.
// Run: node --test games/invaders/translated/test/loc_021a.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_021a } from "../loc_021a.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x021a, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
}

test("loc_021a: xra a clears A (=0, Z+P set), falls through to loc_021b; 4 T", () => {
  const m = makeMachine();
  m.regs.a = 0xa5; // prove xra a zeroes whatever was there

  loc_021a(m);

  assert.equal(m.regs.a, 0x00, "A := 0 via xra a");
  assert.equal(m.regs.fZ, true, "xra a sets Z");
  assert.equal(m.regs.fC, false, "xra a clears carry");
  assert.equal(m.tstates, 4, "T: xra(4)");
  assert.equal(m.pc, 0x021b, "last step lands at the fall-through head");
  assert.deepEqual(m.pcSeq, [0x021b], "single step boundary");
  assert.deepEqual(m.calls, [0x021b], "falls through into loc_021b");
});

test("loc_021a MUTATION: `xra a` mis-charged 7T (not 4T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x021b ? 7 : c);
  loc_021a(m);
  assert.equal(m.tstates, 7, "mutation adds 3 T (4 -> 7)");
  assert.notEqual(m.tstates, 4, "golden T-state total catches the mutant");
});
