// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_0000 (ROM 0x0000, Pooyan) -- the reset vector:
 * xor a; ld (0xA180),a; jp 0x0092. Self-contained mock machine (real Regs for exact
 * flags, flat 64K RAM, step/call mirroring the DK Machine). Pins the single straight
 * path off the disassembly: A=0 (Z set), the mainlatch write clears NMI-enable, a
 * tail-jp to 0x0092, T = 4+13+10 = 27, pcSeq the three instruction boundaries.
 * TEETH: mis-charge `jp` as 4 T -- the T-state golden must catch it.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0000 } from "../loc_0000.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x0000, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

test("loc_0000 reset: xor a; ld (0xA180),a; jp 0x0092", () => {
  const m = makeMachine();
  m.regs.a = 0x5a; // arbitrary non-zero -> xor a must zero it
  loc_0000(m);
  assert.equal(m.regs.a, 0x00, "xor a -> A = 0");
  assert.equal(m.regs.f & 0x40, 0x40, "Z flag set (xor a of 0)");
  assert.equal(m.mem.read8(0xa180), 0x00, "mainlatch bit0 write cleared NMI-enable");
  assert.equal(m.tstates, 27, "T = 4 (xor) + 13 (ld) + 10 (jp)");
  assert.deepEqual(m.pcSeq, [0x0001, 0x0004, 0x0092], "instruction boundaries off the disasm");
  assert.deepEqual(m.calls, [0x0092], "tail-jp delegates to loc_0092");
});

test("loc_0000 MUTATION: `jp` mis-charged 4T (not 10T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x0092 ? 4 : cycles);
  loc_0000(m);
  assert.equal(m.tstates, 21, "mutation loses 6 T (10 -> 4)");
  assert.throws(() => assert.equal(m.tstates, 27, "T = 4 (xor) + 13 (ld) + 10 (jp)"),
    /T = 4/, "the T-state golden must fail on the mutant");
});
