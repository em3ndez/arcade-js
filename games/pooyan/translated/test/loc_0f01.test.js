// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_0f01 (ROM 0x0f01, Pooyan): command 0x09 -- `ld a,0x09` then a
// tail-`jr 0x0eb3` into the sound-ring enqueue helper. Flat-RAM mock with a real stack; the
// mock's `call` POPS (models the tail callee's ret consuming the seated CALLER_RET), so the
// stack fully unwinds to the pre-seat baseline. T = 7 (ld) + 12 (jr).
// Run: node --test games/pooyan/translated/test/loc_0f01.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0f01 } from "../loc_0f01.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x0f01, pcSeq: [],
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
    // The tail callee's `ret` pops the return address the ORIGINAL caller seated (no push16 at a
    // tail site) -- model that pop so the stack stays balanced to the pre-seat baseline.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_0f01: A=0x09 -> tail into loc_0eb3", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_0f01(m);

  assert.equal(m.regs.a, 0x09, "A = 0x09 handed to loc_0eb3");
  assert.equal(m.tstates, 19, "T = 7 (ld) + 12 (jr)");
  assert.equal(m.pc, 0x0eb3, "tail lands at the delegate entry");
  assert.deepEqual(m.calls, [0x0eb3], "delegates to loc_0eb3");
  assert.deepEqual(m.pcSeq, [0x0f03, 0x0eb3], "step boundaries match the disassembly");
  // Tail jp: the callee's ret consumes the seated CALLER_RET, so SP returns to the pre-seat
  // baseline. A stray push16 before the tail would leave SP off by 2 here.
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
});

test("loc_0f01 MUTATION: `jr 0x0eb3` mis-charged 7T (not 12T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0eb3 ? 7 : c);

  loc_0f01(m);

  assert.equal(m.tstates, 14, "mutation loses 5 T (12 -> 7)");
  assert.throws(() => assert.equal(m.tstates, 19, "golden"), /19/, "golden T total catches the mutant");
});
