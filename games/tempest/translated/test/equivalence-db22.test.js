// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_db22 (ROM 0xdb22). Minimal 6502 harness (Regs + flat RAM + page-1 stack +
// call recorder). Run: node --test games/tempest/translated/test/equivalence-db22.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_db22 } from "../loc_db22.js";

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
    call(target) { this.calls.push(target); this.pc = target; if (this._retPushed) { this._retPushed = false; this.pull16(); } },
  };
}

test("loc_db22: clears the $60xx bank, rol-walks a bit across $6080.., tail-jumps df39; 444 T", () => {
  const m = makeMachine();
  m.regs.s = 0xff;
  // pre-seed the cleared cells non-zero to prove the stores land
  m.ram[0x6000] = 0x55; m.ram[0x6040] = 0x55; m.ram[0x60c0] = 0x55;
  m.ram[0x60d0] = 0x55; m.ram[0x6080] = 0x55;

  loc_db22(m);

  assert.equal(m.mem.read8(0x6000), 0x00, "$6000 cleared");
  assert.equal(m.mem.read8(0x6040), 0x00, "$6040 cleared");
  assert.equal(m.mem.read8(0x60c0), 0x00, "$60c0 cleared");
  assert.equal(m.mem.read8(0x60d0), 0x00, "$60d0 cleared");
  assert.equal(m.mem.read8(0x60e0), 0x08, "$60e0 = 0x08 (final of 0x00 then 0x08)");
  // rol walk: x=0x1f writes A=0x01, then rol (C started clear) -> 0x02, 0x04, ...
  assert.equal(m.mem.read8(0x609f), 0x01, "first store: A=0x01 at $6080+0x1f");
  assert.equal(m.mem.read8(0x609e), 0x02, "after rol -> 0x02");
  assert.equal(m.mem.read8(0x609d), 0x04, "after rol -> 0x04");
  assert.equal(m.mem.read8(0x609c), 0x08, "after rol -> 0x08");
  assert.deepEqual(m.calls, [0xdf39], "tail-jump to loc_df39");
  assert.equal(m.pc, 0xdf39, "final PC at df39");
  assert.equal(m.cycles, 444, "computed total T (54 setup + 383 loop + 7 tail)");
});
