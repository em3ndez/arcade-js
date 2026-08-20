// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_0f05 (ROM 0x0f05, Pooyan): command 0x0a -- `ld a,0x0a` then a
// tail-`jr 0x0ea2` into the text-ring append helper. Flat-RAM mock with a real stack; the
// mock's `call` POPS (models the tail callee's ret consuming the seated CALLER_RET), so the
// stack fully unwinds to the pre-seat baseline. T = 7 (ld) + 12 (jr).
// Run: node --test games/pooyan/translated/test/loc_0f05.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0f05 } from "../loc_0f05.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x0f05, pcSeq: [],
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

test("loc_0f05: A=0x0a -> tail into loc_0ea2", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_0f05(m);

  assert.equal(m.regs.a, 0x0a, "A = 0x0a handed to loc_0ea2");
  assert.equal(m.tstates, 19, "T = 7 (ld) + 12 (jr)");
  assert.equal(m.pc, 0x0ea2, "tail lands at the delegate entry");
  assert.deepEqual(m.calls, [0x0ea2], "delegates to loc_0ea2");
  assert.deepEqual(m.pcSeq, [0x0f07, 0x0ea2], "step boundaries match the disassembly");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline (tail callee ret pops CALLER_RET)");
});

test("loc_0f05 MUTATION: `jr 0x0ea2` mis-charged 7T (not 12T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0ea2 ? 7 : c);

  loc_0f05(m);

  assert.equal(m.tstates, 14, "mutation loses 5 T (12 -> 7)");
  assert.throws(() => assert.equal(m.tstates, 19, "golden"), /19/, "golden T total catches the mutant");
});
