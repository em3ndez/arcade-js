// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_0714 (ROM 0x0714, Pooyan) -- one iteration of the
 * sprite-attribute copy loop. Self-contained mock machine (real Regs, flat 64K RAM,
 * step/call mirroring the DK Machine). loc_0714 falls through into loc_0728, so its only
 * exit is `return m.call(0x0728)`; the test asserts that delegation plus the four byte
 * copies, the register walk (hl via inc l, de +2, ix +1), and the 118-T budget.
 *
 * Opcode boundaries are cross-checked against MAME's executed-PC log (0714,0715,0718,
 * 0719,071a,071d,071e,071f,0720,0721,0722,0723,0724,0725,0726,0728).
 *
 * TEETH: mis-charge `ld (ix+0x01),a` (0x0715, DD-indexed store, 19 T) as 13 T (the plain
 * `ld (nn),a` timing) -- a plausible slip; the 118-T golden MUST catch it.
 *
 * Run: node --test games/pooyan/translated/test/loc_0714.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0714 } from "../loc_0714.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x0714, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

const PC = [
  0x0715, 0x0718, 0x0719, 0x071a, 0x071d, 0x071e, 0x071f, 0x0720,
  0x0721, 0x0722, 0x0723, 0x0724, 0x0725, 0x0726, 0x0728,
];

function setup(m) {
  m.regs.hl = 0x8840;   // source (matches loc_066d: ld hl,0x8840)
  m.regs.ix = 0x9410;   // sprite bank1 (matches loc_066d: ld ix,0x9410)
  m.regs.de = 0x9010;   // sprite bank0 (matches loc_066d: ld de,0x9010)
  m.mem.write8(0x8840, 0xaa);
  m.mem.write8(0x8841, 0xbb);
  m.mem.write8(0x8842, 0xcc);
  m.mem.write8(0x8843, 0xdd);
}

function assertGolden(m) {
  assert.equal(m.tstates, 118, "loc_0714 T-state total");
  assert.equal(m.mem.read8(0x9411), 0xaa, "(ix+0x01) = first source byte");
  assert.equal(m.mem.read8(0x9410), 0xbb, "(ix+0x00) = second source byte");
  assert.equal(m.mem.read8(0x9010), 0xcc, "(de) = third source byte");
  assert.equal(m.mem.read8(0x9011), 0xdd, "(de+1) = fourth source byte");
}

test("loc_0714: four byte-copies + register walk, delegates to loc_0728", () => {
  const m = makeMachine();
  setup(m);
  loc_0714(m);
  assertGolden(m);
  assert.equal(m.pc, 0x0728, "final step lands on the loc_0728 boundary");
  assert.deepEqual(m.calls, [0x0728], "falls through -> m.call(0x0728)");
  assert.equal(m.regs.hl, 0x8844, "hl walked +4 via inc l (stays in-page)");
  assert.equal(m.regs.de, 0x9012, "de walked +2");
  assert.equal(m.regs.ix, 0x9411, "ix bumped +1 here (loc_0728 adds the second)");
  assert.equal(m.regs.a, 0xdd, "A = last byte read");
  assert.deepEqual(m.pcSeq, PC, "step boundaries match MAME's executed-PC log");
});

test("loc_0714 MUTATION: `ld (ix+0x01),a` mis-charged 13T (not 19T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  let first = true;
  m.step = (nextAddr, cycles) => {
    if (first && nextAddr === 0x0718) { first = false; return realStep(nextAddr, 13); }
    return realStep(nextAddr, cycles);
  };
  setup(m);
  loc_0714(m);
  assert.equal(m.tstates, 112, "mutation loses exactly 6 T (19 -> 13)");
  assert.throws(() => assertGolden(m), /loc_0714 T-state total/,
    "the 118-T golden must fail on the mutant");
});
