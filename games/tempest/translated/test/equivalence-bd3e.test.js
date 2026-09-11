// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_bd3e (ROM 0xbd3e-0xbd9f). Minimal 6502 harness (Regs + flat RAM + the page-1
// stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration check.
// $6040 is seeded bit7-clear so the bit/bmi spin exits immediately; inputs are chosen to bound the
// normalize loop. Run: node --test games/tempest/translated/test/equivalence-bd3e.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_bd3e } from "../loc_bd3e.js";

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

test("loc_bd3e: $57 < 0x10 -> trivial (a=1,y=0) form, 2-byte entry, rts; 51 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // rts -> 0x1234
  m.ram[0x0057] = 0x05; // < 0x10 -> BCC taken -> bd8c
  m.ram[0x0074] = 0x00; m.ram[0x0075] = 0x63; // ($74) -> 0x6300
  m.ram[0x00a9] = 0x04; // ldy 0xa9

  loc_bd3e(m);

  assert.equal(m.ram[0x0078], 0x01, "$78 = 0x01 (the a=1 form)");
  assert.equal(m.ram[0x6304], 0x00, "mantissa byte 0 (tya=0) at ($74),4");
  assert.equal(m.ram[0x6305], 0x71, "0x01 | 0x70 = 0x71 at ($74),5");
  assert.equal(m.regs.a, 0x71, "a = 0x71 after ora #0x70");
  assert.equal(m.regs.y, 0x06, "y = 6 after the two iny (4->6)");
  assert.equal(m.pc, 0x1234, "rts -> pushed + 1");
  assert.equal(m.cycles, 3 + 2 + 3 + 2 + 2 + 3 + 3 + 2 + 3 + 6 + 2 + 4 + 2 + 6 + 2 + 6, "51 T");
});

test("loc_bd3e: $57 >= 0x10 -> math-box path (spin exits, normalize 2 iters), rts", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000); // rts -> 0x2001
  m.ram[0x0057] = 0x20; // >= 0x10 -> BCC not taken -> bd44
  m.ram[0x005f] = 0x05; // sbc 0x5f: 0x20 - 0x05 = 0x1b (C set from sec)
  m.ram[0x005b] = 0x00; // sbc 0x5b: 0x00 - 0x00 = 0x00 (C still set)
  m.ram[0x00a0] = 0x40; // -> $608e and $6094
  m.ram[0x6040] = 0x00; // bit7 clear -> spin exits after one bit/bmi
  m.ram[0x6060] = 0x00; // -> $79 (asl operand)
  m.ram[0x6070] = 0x41; // -> $7a and a; sbc #0x01 -> 0x40 (Z clear -> BNE taken)
  m.ram[0x0074] = 0x00; m.ram[0x0075] = 0x63; // ($74) -> 0x6300
  m.ram[0x00a9] = 0x02; // ldy 0xa9

  loc_bd3e(m);

  // 16-bit subtract results
  assert.equal(m.ram[0x6095], 0x1b, "$6095 = 0x20 - 0x5f");
  assert.equal(m.ram[0x6096], 0x00, "$6096 = 0x00 - 0x5b - borrow");
  // math-box control writes
  assert.equal(m.ram[0x608e], 0x40, "$608e = $a0");
  assert.equal(m.ram[0x6094], 0x40, "$6094 = $a0");
  assert.equal(m.ram[0x608c], 0x0f, "$608c last written by stx #0x0f");
  assert.equal(m.ram[0x007a], 0x41, "$7a = $6070");
  // normalize loop: a=0x40 -> two rols to carry out; x counts 2, $79 stays 0x00
  assert.equal(m.ram[0x0079], 0x00, "$79 shifted (stayed 0x00)");
  assert.equal(m.ram[0x0078], 0x02, "$78 = x = 2 (normalize iterations)");
  assert.equal(m.ram[0x6302], 0x80, "mantissa (tya, from adc chain) at ($74),2 = 0x80");
  assert.equal(m.ram[0x6303], 0x72, "0x02 | 0x70 = 0x72 at ($74),3");
  assert.equal(m.regs.a, 0x72, "a = 0x72 after final ora");
  assert.equal(m.regs.y, 0x04, "y = 4 after the two iny (2->4)");
  assert.equal(m.pc, 0x2001, "rts -> pushed + 1");
  assert.equal(
    m.cycles,
    // bd3e..bd42
    3 + 2 + 2 +
    // bd44..bd5b
    2 + 3 + 4 + 2 + 3 + 4 + 2 + 4 + 3 + 4 + 4 +
    // spin (1 iter, not taken)
    4 + 2 +
    // bd63..bd6f
    4 + 3 + 4 + 3 + 2 + 4 +
    // bd72..bd75 (bne taken)
    2 + 2 + 3 +
    // bd79 ldx#00
    2 +
    // normalize loop iter1 (taken) + iter2 (not taken)
    (2 + 5 + 2 + 3) + (2 + 5 + 2 + 2) +
    // bd81..bd8a (bvc taken)
    2 + 2 + 2 + 2 + 2 + 2 + 2 + 3 +
    // bd90..bd9f
    3 + 3 + 2 + 3 + 6 + 2 + 4 + 2 + 6 + 2 + 6,
    "golden T-state total for the math-box path",
  );
});
