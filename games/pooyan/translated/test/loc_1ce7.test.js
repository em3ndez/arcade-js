// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_1ce7 (ROM 0x1ce7-0x1ceb): set HL=0x84e0, store 0x02, delegate to
// loc_1cec. Flat-RAM mock, real Regs. loc_1cec is reached by tail-delegate (m.call), recorded.
//
// Run: node --test games/pooyan/translated/test/loc_1ce7.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1ce7 } from "../loc_1ce7.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

test("loc_1ce7: HL=0x84e0, (0x84e0)=0x02, delegate 0x1cec; 20 T", () => {
  const m = makeMachine();

  loc_1ce7(m);

  assert.equal(m.tstates, 20, "T-state total (10 + 10)");
  assert.equal(m.regs.hl, 0x84e0, "HL carried forward for loc_1cec");
  assert.equal(m.mem.read8(0x84e0), 0x02, "tile 0x02 stored at 0x84e0");
  assert.deepEqual(m.calls, [0x1cec], "tail-delegate to loc_1cec");
  assert.deepEqual(m.pcSeq, [0x1cea, 0x1cec], "boundaries");
});

test("loc_1ce7 MUTATION: ld (hl) mis-charged 4T (not 10T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1cec ? 4 : c);

  loc_1ce7(m);

  assert.equal(m.tstates, 14, "mutation loses 6 T (10 -> 4)");
  assert.notEqual(m.tstates, 20, "golden T-state total catches the mutant");
});
