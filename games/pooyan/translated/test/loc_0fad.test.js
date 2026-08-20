// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_0fad (ROM 0x0fad, Pooyan): tile code 0x26 -- `ld a,0x26` then a
// tail-`jp 0x0fc3` into the 4-tile emitter. Flat-RAM mock with a real stack; the mock's `call`
// POPS (models the tail callee's ret consuming the seated CALLER_RET), so the stack fully
// unwinds to the pre-seat baseline. T = 7 (ld) + 10 (jp).
// Run: node --test games/pooyan/translated/test/loc_0fad.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0fad } from "../loc_0fad.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x0fad, pcSeq: [],
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
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

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_0fad: A=0x26 -> tail into loc_0fc3", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_0fad(m);

  assert.equal(m.regs.a, 0x26, "tile code 0x26 handed to loc_0fc3");
  assert.equal(m.tstates, 17, "T = 7 (ld) + 10 (jp)");
  assert.equal(m.pc, 0x0fc3, "tail lands at the emitter entry");
  assert.deepEqual(m.calls, [0x0fc3], "delegates to loc_0fc3");
  assert.deepEqual(m.pcSeq, [0x0faf, 0x0fc3], "step boundaries match the disassembly");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline (tail callee ret pops CALLER_RET)");
});

test("loc_0fad MUTATION: `jp 0x0fc3` mis-charged 7T (not 10T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0fc3 ? 7 : c);

  loc_0fad(m);

  assert.equal(m.tstates, 14, "mutation loses 3 T (10 -> 7)");
  assert.throws(() => assert.equal(m.tstates, 17, "golden"), /17/, "golden T total catches the mutant");
});
