// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_c196 (ROM 0xc196). Clamps ($9f&0x70) to <=0x5f, indexes $c1fd table, and
// for Y=7..0 splits each byte's nibbles into $0019/$0800 (low) and $0021/$0808 (high).
// Run: node --test games/tempest/translated/test/equivalence-c196.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_c196 } from "../loc_c196.js";

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

test("loc_c196: $9f=0x30 (no clamp) -> X=(0x30>>1)|7=0x1f; table byte 0x5c -> low 0xc / high 0x5; 399 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x5000); // rts -> 0x5001
  m.mem.write8(0x9f, 0x30);
  // table read is $c1fd,x for x=0x18..0x1f -> $c215..$c21c
  for (let a = 0xc215; a <= 0xc21c; a++) m.mem.write8(a, 0x5c);

  loc_c196(m);

  // low nibble 0xc into $0019..$0020 and $0800..$0807; high nibble 0x5 into $0021..$0028 and $0808..$080f
  assert.equal(m.mem.read8(0x0019), 0x0c, "low nibble y=0");
  assert.equal(m.mem.read8(0x0020), 0x0c, "low nibble y=7");
  assert.equal(m.mem.read8(0x0800), 0x0c, "low mirror y=0");
  assert.equal(m.mem.read8(0x0807), 0x0c, "low mirror y=7");
  assert.equal(m.mem.read8(0x0021), 0x05, "high nibble y=0");
  assert.equal(m.mem.read8(0x0028), 0x05, "high nibble y=7");
  assert.equal(m.mem.read8(0x0808), 0x05, "high mirror y=0");
  assert.equal(m.mem.read8(0x080f), 0x05, "high mirror y=7");
  assert.equal(m.regs.x, 0x17, "X = 0x1f - 8");
  assert.equal(m.regs.y, 0xff, "Y wrapped past 0");
  assert.equal(m.pc, 0x5001, "rts -> pushed + 1");
  assert.equal(m.cycles, 399, "18 prologue + 375 loop (page-crossed table reads) + 6 rts");
});

test("loc_c196: $9f=0x7f clamps to 0x5f -> X=(0x5f>>1)|7=0x2f, ends X=0x27, Y=0xff", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x6000);
  m.mem.write8(0x9f, 0x7f);

  loc_c196(m);

  assert.equal(m.regs.x, 0x27, "X = 0x2f - 8 after clamp path");
  assert.equal(m.regs.y, 0xff);
  assert.equal(m.pc, 0x6001);
});
