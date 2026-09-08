// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_39ea (ROM 0x39ea-0x3a08). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_39ea.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_39ea } from "../loc_39ea.js";

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

test("loc_39ea: A bits7,6 both set -> both BCC not taken -> Y=0 leaf; 16 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> 0x1234
  m.regs.a = 0xc0; // 1100_0000: ASL sets C twice
  m.regs.y = 0x33; // clobbered to 0

  loc_39ea(m);

  assert.equal(m.regs.a, 0x00, "0xc0 ASL twice = 0x00");
  assert.equal(m.regs.y, 0x00, "LDY #$00 on the both-bits-set path");
  assert.equal(m.cycles, 2 + 2 + 2 + 2 + 2 + 6, "16 T (ASL, BCC nt, ASL, BCC nt, LDY, RTS)");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "leaf: no m.call");
});

test("loc_39ea: bit7 set bit6 clear, Y<6 -> INY path; 24 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.regs.a = 0x80; // 1000_0000: first ASL C=1, second ASL C=0 -> BCC taken to CPY #$06 arm
  m.regs.y = 0x03; // < 6 -> BEQ nt, BCC taken -> INY

  loc_39ea(m);

  assert.equal(m.regs.a, 0x00, "0x80 ASL twice = 0x00");
  assert.equal(m.regs.y, 0x04, "Y = 0x03 + 1 (INY, Y<6 path)");
  assert.equal(m.cycles, 2 + 2 + 2 + 3 + 2 + 2 + 3 + 2 + 6, "24 T");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "leaf: no m.call");
});

test("loc_39ea: bit7 clear, Y<0xfa -> LDY#0/DEY path with extra ASL; 23 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.regs.a = 0x21; // bit7 clear -> first BCC taken to CPY #$fa arm; 0x21<<1=0x42, then <<1=0x84
  m.regs.y = 0x10; // < 0xfa -> BEQ nt, BCS nt -> LDY #0, DEY -> 0xff

  loc_39ea(m);

  assert.equal(m.regs.a, 0x84, "0x21 ASL (0x42) then final ASL (0x84)");
  assert.equal(m.regs.y, 0xff, "LDY #$00 then DEY -> 0xff");
  assert.equal(m.cycles, 2 + 3 + 2 + 2 + 2 + 2 + 2 + 2 + 6, "23 T");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "leaf: no m.call");
});

test("loc_39ea MUTATION: the DEY-path ASL mischarged 3T not 2T is caught by the total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.regs.a = 0x21;
  m.regs.y = 0x10;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x39fd ? 3 : c); // the 0x39fc ASL A step lands at 0x39fd
  loc_39ea(m);
  assert.notEqual(m.cycles, 23, "a mischarged cycle blows the golden T-state total");
});
