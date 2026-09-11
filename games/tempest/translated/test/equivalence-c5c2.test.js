// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_c5c2 (ROM 0xc5c2). Minimal 6502 harness; the JSRs (df6a, c66d, c6c7) and the
// final jmp df5f are recorded but not run. Main path forces the $0114!=0 branch so every one of the 16
// slots runs the header copy (4 bytes from the $c669 table, reversed) + jsr c66d + jsr c6c7. Guard paths
// exercise the two early rts exits. Run: node --test games/tempest/translated/test/equivalence-c5c2.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_c5c2 } from "../loc_c5c2.js";

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

test("loc_c5c2: main path ($0114!=0) -- 16 slots, header copy + paired jsrs, jmp df5f; 1946 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;

  m.ram[0x0110] = 0x00; // guard 1: beq taken past rts
  m.ram[0x5b] = 0x01;   // guard 2: bne taken -> skip $5f check
  m.ram[0x0111] = 0x00; // slot count = 16 (x stays 0x0f)
  m.ram[0x0114] = 0x01; // force the paired-jsr path every slot
  m.ram[0x74] = 0x00; m.ram[0x75] = 0x50; // display list ($74) -> 0x5000
  // $c669 4-byte header table (lda $c669,x with x=3..0 -> reversed into ($74),y=0..3)
  m.ram[0xc669] = 0x11; m.ram[0xc66a] = 0x22; m.ram[0xc66b] = 0x33; m.ram[0xc66c] = 0x44;
  m.ram[0x039a] = 0x03; // slot-0 accumulator, asl'd once -> 0x06

  loc_c5c2(m);

  // first slot's header at 0x5000..0x5003, reversed table order
  assert.equal(m.mem.read8(0x5000), 0x44, "($74),0 = $c66c");
  assert.equal(m.mem.read8(0x5001), 0x33, "($74),1 = $c66b");
  assert.equal(m.mem.read8(0x5002), 0x22, "($74),2 = $c66a");
  assert.equal(m.mem.read8(0x5003), 0x11, "($74),3 = $c669");
  // 16th slot's header at offset 60..63
  assert.equal(m.mem.read8(0x5000 + 60), 0x44, "slot 16 header still copied");
  assert.equal(m.mem.read8(0x039a), 0x06, "$039a[slot0] asl'd once: 0x03 -> 0x06");
  assert.equal(m.mem.read8(0x38), 0x10, "$38 slot index incremented to 16");
  assert.equal(m.mem.read8(0xaa), 0x00, "$aa restored from pha of $74");
  assert.equal(m.mem.read8(0xab), 0x50, "$ab restored from pha of $75");
  assert.equal(m.regs.y, 0x3f, "Y = $a9(0x40) - 1 after final dey");
  assert.equal(m.regs.s, 0xfd, "stack balanced (pha/pla + recorded jsrs)");
  assert.equal(m.pc, 0xdf5f, "jmp df5f tail");
  const expectedCalls = [0xdf6a];
  for (let i = 0; i < 16; i++) { expectedCalls.push(0xc66d, 0xc6c7); }
  expectedCalls.push(0xdf5f);
  assert.deepEqual(m.calls, expectedCalls, "df6a, then (c66d,c6c7)x16, then df5f");
  assert.equal(m.cycles, 1946, "53 prologue + 16*(114 + branch) loop + 22 epilogue");
});

test("loc_c5c2: guard 1 -- $0110!=0 -> immediate rts, 12 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1234); // rts -> 0x1235
  m.ram[0x0110] = 0x01; // beq not taken -> c5c7 rts

  loc_c5c2(m);

  assert.equal(m.pc, 0x1235, "rts -> pushed + 1");
  assert.deepEqual(m.calls, [], "no calls on guard exit");
  assert.equal(m.cycles, 12, "4 (lda abs) + 2 (beq fall) + 6 (rts)");
});

test("loc_c5c2: guard 2 -- $5b==0 & $5f>=0xf0 -> rts, 25 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1000); // rts -> 0x1001
  m.ram[0x0110] = 0x00; // beq taken
  m.ram[0x5b] = 0x00;   // bne not taken -> check $5f
  m.ram[0x5f] = 0xf5;   // >= 0xf0 -> bcc not taken -> c5d2 rts

  loc_c5c2(m);

  assert.equal(m.pc, 0x1001, "rts -> pushed + 1");
  assert.deepEqual(m.calls, [], "no calls on guard exit");
  assert.equal(m.cycles, 25, "4+3 +3+2 +3+2 +2 +6");
});
