// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_aa13 (ROM 0xaa13-0xaa59). Minimal 6502 harness (Regs + flat RAM + page-1
// stack seam), author-derived. loc_af77 is opaque (harness records the call). The routine ends in a
// JMP tail-call to loc_df09 (recorded, no rts here), so no initial return is pushed; the internal
// pha/pla pair is balanced. Run: node --test .../loc_aa13.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_aa13 } from "../loc_aa13.js";

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

test("loc_aa13: $05 negative -> BMI taken, X=$3e; copies 3 bytes; $05<0 -> calls loc_af77; tail JMP df09; 110 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.regs.a = 0x00;
  m.ram[0x3e] = 0x00;        // X = 0
  m.ram[0x05] = 0x80;        // negative -> BMI taken (skip the $43/$44/$45 test); later BPL not taken
  m.ram[0xce66] = 0x02;      // count = 2 -> Y = 2 (3 bytes: y=2,1,0)
  m.ram[0xcde6] = 0xd0; m.ram[0xcde7] = 0xd1; m.ram[0xcde8] = 0xd2;
  m.ram[0x9f] = 0x10;

  loc_aa13(m);

  assert.equal(m.ram[0x2f60], 0xd0, "($74)+0 = $cde6,0");
  assert.equal(m.ram[0x2f61], 0xd1, "($74)+1 = $cde6,1");
  assert.equal(m.ram[0x2f62], 0xd2, "($74)+2 = $cde6,2");
  assert.equal(m.ram[0x74], 0x63, "$74 restored from pla = sec+0x60+count = 0x63");
  assert.equal(m.ram[0x75], 0x2f, "$75 rewritten 0x2f in the $05<0 branch");
  assert.equal(m.regs.a, 0x63, "A = pla value");
  assert.equal(m.pc, 0xdf09, "tail JMP to loc_df09");
  assert.deepEqual(m.calls, [0xaf77, 0xdf09], "JSR loc_af77 then tail loc_df09");
  assert.equal(m.cycles, 33 + 29 + 48, "prologue 33 + 2-pass copy 29 + tail block 48 = 110");
});

test("loc_aa13: $05 positive & ($43|$44|$45)!=0 -> X=1; BPL taken skips loc_af77; tail JMP df09; 85 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.regs.a = 0x00;
  m.ram[0x3e] = 0x00;
  m.ram[0x05] = 0x00;        // positive -> BMI not taken; BPL taken (skip af77)
  m.ram[0x43] = 0x01;        // ora nonzero -> beq not taken -> ldx #1
  m.ram[0xce67] = 0x01;      // count = 1 (X=1) -> Y = 1 (2 bytes)
  m.ram[0xcde6] = 0xe0; m.ram[0xcde7] = 0xe1;

  loc_aa13(m);

  assert.equal(m.ram[0x2f60], 0xe0, "($74)+0");
  assert.equal(m.ram[0x2f61], 0xe1, "($74)+1");
  assert.equal(m.ram[0x74], 0x62, "$74 = pla = 1+0x60+1 = 0x62");
  assert.equal(m.regs.a, 0x62, "A = pla value");
  assert.equal(m.pc, 0xdf09, "tail JMP to loc_df09");
  assert.deepEqual(m.calls, [0xdf09], "loc_af77 skipped, only the tail call");
  assert.equal(m.cycles, 45 + 40, "prologue+setup 45 + copy/tail 40 = 85");
});
