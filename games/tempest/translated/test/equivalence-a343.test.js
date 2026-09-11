// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a343 (ROM 0xa343-0xa34a) -- two demo entries that seed A with a per-entry
// tag (a343 -> 9, a347 -> 7) then jmp into loc_a34d (in loc_a34b.js): each delegates via m.call(0xa34d)
// with NO push16 (a bne, not a jsr), lands pc at 0xa34d, and takes lda #imm(2) + bne same-page(3) = 5.
// Run: node --test games/tempest/translated/test/equivalence-a343.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a343, loc_a347 } from "../loc_a343.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, calls: [],
    step(next, c) { this.pc = next; this.cycles += c; },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    // record each delegate/JSR target; a jmp-delegate pushes nothing so retAddrs must stay empty
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; (this.retAddrs ||= []).push(this.pull16()); } return undefined; },
  };
}

test("loc_a343 (tag 9): A=9, jmp-delegate to loc_a34d, no push16", () => {
  const m = makeMachine(); m.regs.s = 0xfd;
  loc_a343(m);
  assert.equal(m.regs.a, 0x09, "A <- 9");
  assert.deepEqual(m.calls, [0xa34d], "delegates to loc_a34d");
  assert.equal(m.retAddrs, undefined, "bne delegate pushes no return");
  assert.equal(m.pc, 0xa34d, "pc lands at the mid-entry");
  assert.equal(m.cycles, 5, "lda #9 (2) + bne same-page taken (3)");
});

test("loc_a347 (tag 7): A=7, jmp-delegate to loc_a34d, no push16", () => {
  const m = makeMachine(); m.regs.s = 0xfd;
  loc_a347(m);
  assert.equal(m.regs.a, 0x07, "A <- 7");
  assert.deepEqual(m.calls, [0xa34d], "delegates to loc_a34d");
  assert.equal(m.retAddrs, undefined, "bne delegate pushes no return");
  assert.equal(m.pc, 0xa34d, "pc lands at the mid-entry");
  assert.equal(m.cycles, 5, "lda #7 (2) + bne same-page taken (3)");
});
