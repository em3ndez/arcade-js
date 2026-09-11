// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_ca6c (ROM 0xca6c) -- BCD (sed) score/bonus add + range-check + sound trigger.
// Minimal 6502 harness (Regs + flat RAM + page-1 stack seam + call recorder), author-derived; the whole-
// machine boot-first state diff vs MAME is the integration check. Run: node --test .../equivalence-ca6c.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_ca6c } from "../loc_ca6c.js";

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

test("loc_ca6c: BIT $05 bit7 clear -> BPL to caef, cld+rts, no writes; 16 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);            // rts -> 0x1234
  m.regs.a = 0x99; m.regs.x = 0x00; m.regs.y = 0x00;
  m.mem.write8(0x05, 0x00);    // bit7 clear -> BPL taken

  loc_ca6c(m);

  assert.equal(m.pc, 0x1234, "rts returns to pushed+1");
  assert.equal(m.regs.fD, false, "cld cleared decimal on the way out");
  assert.deepEqual(m.calls, [], "no sound fired on the skip path");
  assert.equal(m.cycles, 2 + 3 + 3 + 2 + 6, "sed+bit+bpl(taken)+cld+rts");
});

test("loc_ca6c: x>=8 branch, decimal add $29->$40 triplet, beq/bcc to caef; 81 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000);            // rts -> 0x2001
  m.regs.x = 0x08;            // cpx #8 -> C set -> bcc not taken (x>=8 path)
  m.mem.write8(0x05, 0x80);    // bit7 set -> enter body
  m.mem.write8(0x3d, 0x00);    // ldy $3d == 0 -> Y stays 0 (beq skips ldy #3)
  m.mem.write8(0x29, 0x25);    // increment lo (BCD)
  m.mem.write8(0x2a, 0x00);
  m.mem.write8(0x2b, 0x00);
  // score triplet $40/$41/$42 start at 0

  loc_ca6c(m);

  assert.equal(m.mem.read8(0x40), 0x25, "$40 = 0x00 + 0x25 (decimal)");
  assert.equal(m.mem.read8(0x41), 0x00, "$41 carry chain = 0");
  assert.equal(m.mem.read8(0x42), 0x00, "$42 carry chain = 0");
  assert.equal(m.regs.fD, false, "decimal cleared before rts");
  assert.equal(m.pc, 0x2001, "rts -> pushed+1");
  assert.deepEqual(m.calls, [], "no sound on this path");
  assert.equal(m.cycles, 81, "full x>=8 add -> caae beq -> cabb bcc -> caef path");
});

test("loc_ca6c: reaches cadc, bumps $48,x under 6 and fires sound loc_ccb9; 121 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x3000);            // rts -> 0x3001
  m.regs.x = 0x08;            // x>=8 path
  m.mem.write8(0x05, 0x80);    // enter body
  m.mem.write8(0x3d, 0x01);    // ldy $3d != 0 -> ldy #3 -> Y = 3 (triplet at $43/$44/$45)
  m.mem.write8(0x29, 0x00);
  m.mem.write8(0x2a, 0x00);
  m.mem.write8(0x2b, 0x05);    // A after lda $2b = 0x05 (Z clear -> beq caae not taken)
  m.mem.write8(0x0156, 0x05);  // ldx $0156 = 5 (nonzero)
  // cpx $2b: 5 == mem[$2b]=5 -> Z set -> beq cadc taken
  m.mem.write8(0x49, 0x02);    // $48,x with x=$3d=1 -> $49 = 2 (< 6)

  loc_ca6c(m);

  assert.equal(m.mem.read8(0x45), 0x05, "$45 = 0 + 0x05 high byte of triplet");
  assert.equal(m.mem.read8(0x49), 0x03, "inc $48,x bumped $49 from 2 -> 3");
  assert.equal(m.mem.read8(0x0124), 0x20, "sta #$20 -> $0124");
  assert.deepEqual(m.calls, [0xccb9], "jsr $ccb9 fired the sound");
  assert.equal(m.regs.x, 0x01, "ldx $3d left x = 1");
  assert.equal(m.regs.a, 0x20, "A = 0x20 live-out");
  assert.equal(m.pc, 0x3001, "rts -> pushed+1 (jsr return balanced by call seam)");
  assert.equal(m.cycles, 121, "full path through cadc + jsr");
});
