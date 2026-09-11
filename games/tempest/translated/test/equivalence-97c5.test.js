// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_97c5 (ROM 0x97c5) -- min-nonzero scan of $02df[0..$011c]. Minimal 6502
// harness recording calls. Run: node --test .../equivalence-97c5.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_97c5 } from "../loc_97c5.js";

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
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; this.pull16(); } return undefined; },
  };
}

test("loc_97c5: all-zero table -> no min, bmi rts, 59 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // rts -> 0x1234
  m.mem.write8(0x011c, 0x02); // scan x = 2,1,0
  // $02df,$02e0,$02e1 all default 0 -> beq every iter -> $2a stays 0xff

  loc_97c5(m);

  assert.equal(m.mem.read8(0x29), 0xff, "$29 unchanged (no non-zero entry)");
  assert.equal(m.mem.read8(0x2a), 0xff, "$2a unchanged -> index negative");
  assert.equal(m.regs.x, 0xff, "X = $2a = 0xff (bmi taken)");
  assert.deepEqual(m.calls, [], "no jsr 0xa7a6 (bailed at bmi)");
  assert.equal(m.pc, 0x1234, "rts -> pushed+1");
  assert.equal(m.cycles, 59, "prologue + 2 full + 1 short loop iter + tail");
});

test("loc_97c5: min at index 1 -> lookup + jsr 0xa7a6, returns A=0xf7", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000);
  m.mem.write8(0x011c, 0x01);   // scan x = 1,0
  m.mem.write8(0x02df + 1, 0x05); // non-zero -> becomes min, index 1
  m.mem.write8(0x02df + 0, 0x00); // zero -> skipped
  m.mem.write8(0x02b9 + 1, 0x42); // lookup value for index 1
  m.mem.write8(0x0200, 0x03);   // Y arg to a7a6
  // harness does not execute a7a6, so A survives as 0x42 -> tay: positive, non-zero
  // -> bmi not taken -> lda #0xf7

  loc_97c5(m);

  assert.equal(m.mem.read8(0x29), 0x05, "$29 = min value");
  assert.equal(m.mem.read8(0x2a), 0x01, "$2a = min index");
  assert.deepEqual(m.calls, [0xa7a6], "jsr 0xa7a6 recorded");
  assert.equal(m.regs.y, 0x42, "tay copied A (a7a6 result stub = pre-call A)");
  assert.equal(m.regs.a, 0xf7, "positive non-zero result -> A = 0xf7");
  assert.equal(m.pc, 0x2001, "rts -> pushed+1");
});
