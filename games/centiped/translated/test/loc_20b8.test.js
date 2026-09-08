// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_20b8 (ROM 0x20b8-0x20e8). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_20b8.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_20b8 } from "../loc_20b8.js";

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

// Full in-range path: cmp>=4 (fall), and every gate ($2c96 leaves C set, $00 & $100a low bits clear)
// falls through to the $2c2b + $2ba8 tail. 65 T.
test("loc_20b8: in-range, gates pass -> $2c2b + $2ba8 tail; 65 T; RTS", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2fff); // RTS -> 0x3000
  m.regs.a = 0x10; // stashed at $70; eor $f0 (=0) leaves 0x10 >= 4 so the first BCC falls
  m.ram[0x00f0] = 0x00;
  m.ram[0x00f3] = 0x00;
  m.ram[0x0000] = 0x00; // $00 & 3 == 0 -> BNE falls
  m.ram[0x100a] = 0x00; // $100a & 3 == 0 -> BNE falls

  loc_20b8(m);

  assert.equal(m.ram[0x0070], 0x10, "STA $70 stashed A on entry");
  assert.equal(m.regs.x, 0x0c, "LDX #$0c set the collision-scan count");
  assert.equal(m.regs.y, 0x00, "LDY #$00");
  assert.equal(m.regs.a, 0x14, "A = (#$04 EOR $f3=0) + $70(0x10) = 0x14");
  assert.equal(m.cycles, 65, "65 T on the full fall-through path");
  assert.equal(m.pc, 0x3000, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [0x2c96, 0x2c2b, 0x2ba8], "collision test then the two tail JSRs");
});

// Out-of-range: cmp<4 takes BCC $20e4 -> JSR $20e8 -> RTS.
test("loc_20b8: out of range (<4) -> JSR $20e8 then RTS; 23 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2fff);
  m.regs.a = 0x02; // eor $f0(=0) -> 0x02 < 4 -> BCC $20e4 taken
  m.ram[0x00f0] = 0x00;

  loc_20b8(m);

  assert.equal(m.ram[0x0070], 0x02, "STA $70 stashed A");
  assert.equal(m.cycles, 3 + 3 + 2 + 3 + 6 + 6, "sta+eor+cmp+bcc(taken)+jsr+rts = 23 T");
  assert.equal(m.pc, 0x3000, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [0x20e8], "only the $20e8 helper");
});

test("loc_20b8 MUTATION: the $100a load mischarged 5T not 4T is caught by the T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2fff);
  m.regs.a = 0x10;
  m.ram[0x00f0] = 0x00;
  m.ram[0x00f3] = 0x00;
  m.ram[0x0000] = 0x00;
  m.ram[0x100a] = 0x00;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x20d0 ? 5 : c); // LDA $100a steps to 0x20d0
  loc_20b8(m);
  assert.notEqual(m.cycles, 65, "a mischarged cycle blows the golden T-state total");
});
