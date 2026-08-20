// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_0ef5 (ROM 0x0ef5, Pooyan) -- sound-command stub 0x06:
 * `ld a,0x06; jr 0x0ea2`. A tail-jr into loc_0ea2 (no push16 of its own), so loc_0ea2's ret
 * returns to loc_0ef5's caller. Pure delegate: the mock records the call without popping
 * (there is no pushed return to consume -- mirrors loc_0728's tail-jump mock).
 *
 * TEETH: mis-charge `ld a,0x06` (7 T) as 4 T (an `ld r,r'` slip) -- the 19-T golden catches it.
 * POSITIVE CONTROL (pure leaf, no push16): the MUTATION test below deletes 3 T and confirms the
 * golden throws; watched failing, then the real cost restores it.
 *
 * Run: node --test games/pooyan/translated/test/loc_0ef5.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0ef5 } from "../loc_0ef5.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x0ef5, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    call(addr) { this.calls.push(addr); return undefined; }, // tail delegate: record only
  };
}

test("loc_0ef5: A=0x06 then tail-jr into loc_0ea2", () => {
  const m = makeMachine();
  loc_0ef5(m);

  assert.equal(m.tstates, 19, "ld a (7) + jr (12)");
  assert.deepEqual(m.pcSeq, [0x0ef7, 0x0ea2], "step boundaries");
  assert.equal(m.regs.a, 0x06, "A loaded with the command byte");
  assert.equal(m.pc, 0x0ea2, "tail-jr lands on loc_0ea2");
  assert.deepEqual(m.calls, [0x0ea2], "delegates to loc_0ea2");
});

test("loc_0ef5 MUTATION: `ld a,0x06` mis-charged 4T (not 7T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x0ef7 ? 4 : cycles);
  loc_0ef5(m);

  assert.equal(m.tstates, 16, "mutation loses 3 T (7 -> 4)");
  assert.throws(() => assert.equal(m.tstates, 19, "golden"), /19/, "the 19-T golden must fail on the mutant");
});
