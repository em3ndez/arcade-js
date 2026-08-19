// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_0fb2 (ROM 0x0fb2, Pooyan) -- enqueue two sound
 * commands: 0x27 via `call 0x0eb3`, then 0x15 via a tail-`jp 0x0eb3`. Each delegates to
 * the ring-buffer enqueue; the `call` pushes its return 0x0fb7 before the seam.
 *
 * Self-contained mock (real Regs, flat RAM, step/call/push16). Both delegations are
 * boundaries the mock's `call` records rather than runs, so the callee's ret never
 * fires here -- the pushed return 0x0fb7 stays on the stack, which the test checks.
 * T = 7 (ld) + 17 (call) + 7 (ld) + 10 (jp) = 41; final PC is the delegate entry 0x0eb3.
 * TEETH: mis-charge the `call` as 10 T (a `jp` slip) -- the golden must catch it.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0fb2 } from "../loc_0fb2.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x0fb2, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

test("loc_0fb2: enqueue 0x27 (call) then 0x15 (tail-jp), both to loc_0eb3", () => {
  const m = makeMachine();
  m.regs.sp = 0x8800;
  loc_0fb2(m);
  assert.equal(m.regs.a, 0x15, "A = 0x15 (second command) at the tail delegation");
  assert.equal(m.tstates, 41, "T = 7 + 17 (call) + 7 + 10 (jp)");
  assert.equal(m.pc, 0x0eb3, "final tail-jp lands at the delegate entry");
  assert.deepEqual(m.calls, [0x0eb3, 0x0eb3], "both commands delegate to loc_0eb3");
  assert.deepEqual(m.pcSeq, [0x0fb4, 0x0eb3, 0x0fb9, 0x0eb3], "step boundaries match the disassembly");
  assert.equal(m.regs.sp, 0x87fe, "the `call` pushed one return address");
  assert.equal(m.mem.read16(0x87fe), 0x0fb7, "return address 0x0fb7 pushed by the `call`");
});

test("loc_0fb2 MUTATION: `call 0x0eb3` mis-charged 10T (not 17T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x8800;
  const realStep = m.step.bind(m);
  let first = true;
  m.step = (nextAddr, cycles) => {
    if (first && nextAddr === 0x0eb3) { first = false; return realStep(nextAddr, 10); } // the call, not the jp
    return realStep(nextAddr, cycles);
  };
  loc_0fb2(m);
  assert.equal(m.tstates, 34, "mutation loses 7 T (17 -> 10)");
  assert.throws(() => assert.equal(m.tstates, 41, "T = 7 + 17 (call) + 7 + 10 (jp)"),
    /17 \(call\)/, "the golden T-state total must fail on the mutant");
});
