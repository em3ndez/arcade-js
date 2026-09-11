// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_ab14 (ROM 0xab14). Minimal 6502 harness; the JSRs (ab0d, df6a, df75, b0d1,
// b0dd) are recorded but not run, so the test exercises the pointer plumbing and the copy loop against
// the routine's own state. Single-iteration loop: the ($3b),1 byte has bit7 set -> bit $2b -> bpl exits.
// Run: node --test games/tempest/translated/test/equivalence-ab14.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_ab14 } from "../loc_ab14.js";

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

test("loc_ab14: X!=0x2c path, one vector-pair copied via $31e4/$31e5,x to ($74); 209 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x9999);
  m.regs.x = 0x00; // != 0x2c -> bne taken, skip $b6/$b7 cache
  // ($ac) -> 0x3000 holds the ($3b) pointer bytes = 0x4000
  m.ram[0xac] = 0x00; m.ram[0xad] = 0x30;
  m.ram[0x3000] = 0x00; m.ram[0x3001] = 0x40; // -> $3b/$3c = 0x4000
  m.ram[0x4000] = 0x00; // ($3b),0 -> $2a (count byte)
  m.ram[0x4001] = 0x82; // ($3b),1 -> $2b, bit7 set -> single iteration; index = 0x02
  m.ram[0xd122] = 0x55; // $d122,x -> $2b (pre-loop, overwritten)
  m.ram[0xd121] = 0x3a; // $d121,x -> pha/lsr4/and0f fan args
  m.ram[0x74] = 0x00; m.ram[0x75] = 0x50; // ($74) -> 0x5000 write target
  m.ram[0x31e6] = 0xab; // $31e4 + 2
  m.ram[0x31e7] = 0xcd; // $31e5 + 2

  loc_ab14(m);

  assert.equal(m.mem.read8(0x5000), 0xab, "$31e4,x low byte written to ($74),0");
  assert.equal(m.mem.read8(0x5001), 0xcd, "$31e5,x high byte written to ($74),1");
  assert.equal(m.mem.read8(0x2a), 0x02, "$2a advanced to 2 after one pair");
  assert.equal(m.mem.read8(0x35), 0x00, "$35 = X saved on entry");
  assert.equal(m.regs.y, 0x01, "Y = $2a - 1 after the final dey");
  assert.equal(m.pc, 0xdf5f, "jmp df5f tail");
  assert.deepEqual(m.calls, [0xab0d, 0xdf6a, 0xdf75, 0xb0d1, 0xb0dd, 0xdf5f], "JSR chain then jmp df5f");
  assert.equal(m.cycles, 209, "146 straight-line + 55 (one loop iter) + 8 post-loop");
});

test("loc_ab14: X==0x2c path caches $74/$75 into $b6/$b7", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x9999);
  m.regs.x = 0x2c; // == 0x2c -> bne not taken -> cache block runs
  m.ram[0xac] = 0x00; m.ram[0xad] = 0x30;
  // $35 = X = 0x2c, so ($ac),y reads at 0x3000 + 0x2c for the pointer pair
  m.ram[0x302c] = 0x00; m.ram[0x302d] = 0x40; // -> $3b/$3c = 0x4000
  m.ram[0x4001] = 0x80; // ($3b),1 bit7 set -> one iter, index 0
  m.ram[0x74] = 0x11; m.ram[0x75] = 0x22; // cached into $b6/$b7 (X==0x2c)
  m.ram[0x31e4] = 0x01; m.ram[0x31e5] = 0x02;

  loc_ab14(m);

  assert.equal(m.mem.read8(0xb6), 0x11, "$74 cached into $b6 (X==0x2c)");
  assert.equal(m.mem.read8(0xb7), 0x22, "$75 cached into $b7 (X==0x2c)");
});
