// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_28bf (ROM 0x28bf-0x2932). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_28bf.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_28bf } from "../loc_28bf.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, pcSeq: [], calls: [],
    step(next, c) { this.pc = next; this.cycles += c; this.pcSeq.push(next); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); return undefined; },
  };
}

// $EF=0x3F -> the grid cell write ($3F^$EF) is 0, so every ($8D),Y read stays 0 (BNE at 2914 never taken)
// and $88=0 keeps the $C2/$D7 indices at 0. loopA clears $0400-$07FF (256x), loopB runs the fixed 46-step
// column sweep ($8F: 0x2D..0). Author-derived cycle budget = 25 + 6401 + 14 + 3843(body) + 182(BPL) = 10315.
function setup(m) {
  m.regs.s = 0xfd;
  m.ram[0x0088] = 0x00;
  m.ram[0x00ef] = 0x3f;
  m.ram[0x100a] = 0x00;
}

test("loc_28bf: clears the object pages then runs the 46-step sweep; falls into loc_2932; 10315 T", () => {
  const m = makeMachine();
  setup(m);

  loc_28bf(m);

  assert.equal(m.ram[0x1404], 0x0f, "$1404 <- 0x0F (early write)");
  assert.equal(m.ram[0x008b], 0x07, "$8b = 8 - 1 = 7 after the last sweep step (b_46 = 8)");
  assert.equal(m.ram[0x00d7], 0x10, "$D7+$88 bumped once per b>=0x14 step: 8 first pass + 8 second = 16");
  assert.equal(m.regs.x, 0xff, "X = 0xFF ($8F underflowed 0 -> 0xFF, ending the sweep)");
  assert.equal(m.regs.a, 0x07, "A = 7 (the surviving $8b value)");
  assert.equal(m.cycles, 10315, "10315 T total");
  assert.equal(m.pc, 0x2932, "no RTS: PC falls through to loc_2932");
  assert.deepEqual(m.calls, [0x2656, 0x2932], "JSR $2656, then tail-call into loc_2932");
});

test("loc_28bf MUTATION: STA $1404 mischarged 5T not 4T is caught by the T-state total", () => {
  const m = makeMachine();
  setup(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x28c4 ? 5 : c); // the STA $1404 step lands at 0x28c4 (once)
  loc_28bf(m);
  assert.notEqual(m.cycles, 10315, "a mischarged cycle blows the golden T-state total");
});
