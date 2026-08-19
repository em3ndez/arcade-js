// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_02e3 (ROM 0x02e3, Pooyan) -- ld hl,0x8402 then
 * falls through into loc_02e6, modelled as a tail-delegate `return m.call(0x02e6)`.
 * Self-contained mock (real Regs, flat 64K RAM); `call` is the tail-jp form (record
 * only, no pop) since this frame delegates rather than making a balanced call.
 *
 * Pins the single path: HL=0x8402, T = 10, delegate to 0x02e6, pcSeq [0x02e6].
 * TEETH: mis-charge `ld hl,nn` as 4 T (not 10) -- the golden must catch it.
 *
 * Run: node --test games/pooyan/translated/test/loc_02e3.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_02e3 } from "../loc_02e3.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x02e3, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

test("loc_02e3: ld hl,0x8402 then delegate to loc_02e6", () => {
  const m = makeMachine();
  loc_02e3(m);
  assert.equal(m.regs.hl, 0x8402, "HL = 0x8402");
  assert.equal(m.tstates, 10, "T = 10 (ld hl,nn)");
  assert.equal(m.pc, 0x02e6, "PC at the 0x02e6 boundary");
  assert.deepEqual(m.calls, [0x02e6], "tail-delegate to loc_02e6");
  assert.deepEqual(m.pcSeq, [0x02e6], "single step boundary");
});

test("loc_02e3 MUTATION: `ld hl,nn` mis-charged 4T (not 10) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x02e6 ? 4 : cycles);
  loc_02e3(m);
  assert.equal(m.tstates, 4, "mutation loses 6 T (10 -> 4)");
  assert.throws(
    () => assert.equal(m.tstates, 10, "T = 10 (ld hl,nn)"),
    /T = 10/,
    "the T-state golden must fail on the mutant",
  );
});
