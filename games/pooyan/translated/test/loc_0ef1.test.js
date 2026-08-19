// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_0ef1 (ROM 0x0ef1, Pooyan) -- enqueue sound command
 * 0x05: `ld a,0x05` then a tail-`jr 0x0eb3` into the ring-buffer enqueue. Modeled as
 * `return m.call(0x0eb3)` (loc_0eb3's ret returns to OUR caller).
 *
 * Self-contained mock (real Regs, flat RAM, step/call). The tail-jump is a boundary:
 * the mock's `call` records the delegate rather than running it, so the final PC is the
 * delegate entry 0x0eb3. T = 7 (ld) + 12 (jr) = 19.
 * TEETH: mis-charge the `jr` as 7 T (a conditional-not-taken slip) -- the golden must catch it.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0ef1 } from "../loc_0ef1.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x0ef1, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

test("loc_0ef1: ld a,0x05; tail-jr into loc_0eb3", () => {
  const m = makeMachine();
  loc_0ef1(m);
  assert.equal(m.regs.a, 0x05, "A = 0x05 (sound command) handed to loc_0eb3");
  assert.equal(m.tstates, 19, "T = 7 (ld) + 12 (jr)");
  assert.equal(m.pc, 0x0eb3, "tail-jr lands at the delegate entry");
  assert.deepEqual(m.calls, [0x0eb3], "delegates to loc_0eb3");
  assert.deepEqual(m.pcSeq, [0x0ef3, 0x0eb3], "step boundaries match the disassembly");
});

test("loc_0ef1 MUTATION: `jr 0x0eb3` mis-charged 7T (not 12T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x0eb3 ? 7 : cycles);
  loc_0ef1(m);
  assert.equal(m.tstates, 14, "mutation loses 5 T (12 -> 7)");
  assert.throws(() => assert.equal(m.tstates, 19, "T = 7 (ld) + 12 (jr)"),
    /T = 7/, "the golden T-state total must fail on the mutant");
});
