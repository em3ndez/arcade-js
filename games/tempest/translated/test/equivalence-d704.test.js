// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_d704 (ROM 0xd704) -- the Tempest IRQ handler. Minimal 6502 harness
// (Regs + flat RAM + the page-1 stack seam with rti + recorded calls), author-derived; the
// whole-machine boot-first state diff vs MAME is the integration check.
// Run: node --test games/tempest/translated/test/equivalence-d704.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_d704 } from "../loc_d704.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, calls: [],
    step(next, c) { this.pc = next; this.cycles += c; },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    rti(c = 6) { regs.p = this.pull8(); this.step(this.pull16() & 0xffff, c); },
    // A JSR pushes a return address that the (stubbed) subroutine's RTS would pop; model that
    // here so the guest stack stays balanced and the closing pla/pla/pla restore A/X/Y, not the
    // leaked JSR words. A bare tail-jmp/dispatch m.call (no preceding push16) leaves the stack be.
    call(target) { this.calls.push(target); if (this._retPushed) { this._retPushed = false; this.pull16(); } return undefined; },
  };
}

// Simulate an IRQ entry: hardware pushed PC then P, then loc_d704 will push A/X/Y itself.
function enterIrq(m, pc, p) {
  m.push16(pc & 0xffff);
  m.push8(p & 0xff);
}

test("loc_d704: main path -- watchdog, frame counter, latch, table pick, timers, rti", () => {
  const m = makeMachine();
  m.regs.s = 0xff;
  m.regs.a = 0x11; m.regs.x = 0x22; m.regs.y = 0x33; // entry regs (saved + restored)
  enterIrq(m, 0xabcd, 0x30);

  // inputs
  m.mem.write8(0x53, 0x10);      // stack-guard passes (S high) + $53 positive
  m.mem.write8(0x60c8, 0x00);
  m.mem.write8(0x52, 0x05);
  m.mem.write8(0x50, 0x02);
  m.mem.write8(0x60d8, 0x20);
  m.mem.write8(0x0c00, 0x00);    // bit6 clear -> no $5800/$4800 pulse
  m.mem.write8(0x4c, 0xaa);
  m.mem.write8(0x4d, 0x01);
  m.mem.write8(0x4e, 0x03);
  m.mem.write8(0x4f, 0x0f);
  m.mem.write8(0xb4, 0x00);
  m.mem.write8(0x13, 0x00); m.mem.write8(0x14, 0x00); m.mem.write8(0x15, 0x00); // all >=0
  m.mem.write8(0x3e, 0x05);
  m.mem.write8(0x05, 0x00);
  m.mem.write8(0x07, 0x10);
  m.mem.write8(0xd7dd, 0x02);
  m.mem.write8(0xa1, 0x01);

  loc_d704(m);

  // watchdog + coin latch
  assert.equal(m.mem.read8(0x5000), 0x10, "$5000 watchdog = $53");
  assert.equal(m.mem.read8(0x60cb), 0x10, "$60cb = $53");
  assert.equal(m.mem.read8(0x0117), 0x00, "$0117 = ($60c8^0x0f)&0x10");
  // frame counter: (($60c8^0f) - $52)&0f -> 0x0a (>=8, no |f0) + $50=0x02 -> 0xfc
  assert.equal(m.mem.read8(0x50), 0xfc, "$50 frame low");
  assert.equal(m.mem.read8(0x52), 0x0f, "$52 = Y ($60c8^0x0f)");
  assert.equal(m.mem.read8(0x60db), 0xfc, "$60db = $50");
  assert.equal(m.mem.read8(0x08), 0x00, "$08 = $0c00");
  // coin/switch fold into $4c-$4f
  assert.equal(m.mem.read8(0x4c), 0x20, "$4c = old Y ($60d8)");
  assert.equal(m.mem.read8(0x4d), 0x20, "$4d fold");
  assert.equal(m.mem.read8(0x4e), 0x23, "$4e fold");
  assert.equal(m.mem.read8(0x4f), 0x20, "$4f fold");
  // output latch
  assert.equal(m.mem.read8(0x4000), 0x00, "$4000 latch (all switches >=0)");
  // table pick x=0 -> $d7dd=0x02; ($02^$a1)&3 ^ $a1 = 0x02
  assert.equal(m.mem.read8(0xa1), 0x02, "$a1 table-bit fold");
  assert.equal(m.mem.read8(0x60e0), 0x02, "$60e0 = $a1");
  // subroutine calls
  assert.deepEqual(m.calls, [0xcf24, 0xcd0a], "jsr cf24 then cd0a");
  // timers
  assert.equal(m.mem.read8(0x53), 0x11, "$53 incremented");
  assert.equal(m.mem.read8(0x07), 0x11, "$07 incremented (no cascade)");
  // no $5800/$4800 pulse ($0c00 bit6 clear)
  assert.equal(m.mem.read8(0x5800), 0x00, "no $5800 pulse");

  // restored regs + rti
  assert.equal(m.regs.a, 0x11, "A restored");
  assert.equal(m.regs.x, 0x22, "X restored");
  assert.equal(m.regs.y, 0x33, "Y restored");
  assert.equal(m.regs.p, 0x30, "P restored from stack (U|B forced)");
  assert.equal(m.regs.s, 0xff, "S back to entry");
  assert.equal(m.pc, 0xabcd, "rti returns to pushed PC (no +1)");
  assert.equal(m.cycles, 253, "total T-states on this path");
});

test("loc_d704: panic path -- low stack pointer -> brk + jmp loc_d93f", () => {
  const m = makeMachine();
  m.regs.s = 0x50; // after 3 phas tsx sees 0x4d < 0xd0 -> bcc taken
  m.regs.a = 0x01; m.regs.x = 0x02; m.regs.y = 0x03;
  m.regs.p = 0x00;

  loc_d704(m);

  assert.deepEqual(m.calls, [0xd93f], "tail-calls loc_d93f");
  assert.equal(m.pc, 0xd93f, "PC at loc_d93f");
  assert.equal(m.regs.fI, true, "brk set I");
  assert.equal(m.cycles, 32, "8 saves/guard + brk(7) + jmp(3)");
});

test("loc_d704: switch bits + timer cascade branch", () => {
  const m = makeMachine();
  m.regs.s = 0xff;
  m.regs.a = 0x00; m.regs.x = 0x00; m.regs.y = 0x00;
  enterIrq(m, 0x9000, 0x20);

  m.mem.write8(0x53, 0x10);
  m.mem.write8(0x60c8, 0x00);
  m.mem.write8(0x52, 0x00);
  m.mem.write8(0x50, 0x00);
  m.mem.write8(0x60d8, 0x00);
  m.mem.write8(0x0c00, 0x00);
  m.mem.write8(0xb4, 0x00);
  m.mem.write8(0x13, 0x80); m.mem.write8(0x14, 0x80); m.mem.write8(0x15, 0x80); // all negative
  m.mem.write8(0x3e, 0x00);
  m.mem.write8(0x05, 0x00);   // bne not taken -> ldx#0 path
  m.mem.write8(0x07, 0xff);   // inc -> 0x00 -> cascade
  m.mem.write8(0x06, 0x05);   // cpx #2 -> C set -> ldx #3
  m.mem.write8(0x0406, 0xff); // cascade
  m.mem.write8(0x0407, 0xff); // cascade
  m.mem.write8(0x0408, 0x00);
  m.mem.write8(0xd7e0, 0x01); // table[x=3]
  m.mem.write8(0xa1, 0x00);

  loc_d704(m);

  assert.equal(m.mem.read8(0x4000), 0x07, "$4000 = 0x04|0x02|0x01 (all switches negative)");
  assert.equal(m.mem.read8(0x07), 0x00, "$07 wrapped");
  assert.equal(m.mem.read8(0x0406), 0x00, "$0406 wrapped");
  assert.equal(m.mem.read8(0x0407), 0x00, "$0407 wrapped");
  assert.equal(m.mem.read8(0x0408), 0x01, "$0408 incremented, cascade stops");
  assert.equal(m.mem.read8(0xa1), 0x01, "$a1 = table[3] fold");
  assert.deepEqual(m.calls, [0xcf24, 0xcd0a], "both subroutines called");
});
