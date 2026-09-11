// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_de1b (ROM 0xde1b) -- the $01ca..$01cf / $6000-block vector state machine.
// Minimal author-derived 6502 harness (Regs + flat RAM + page-1 stack seam); the whole-machine
// boot-first state diff vs MAME is the integration check. Run: node --test games/tempest/translated/test/equivalence-de1b.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_de1b } from "../loc_de1b.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, pcSeq: [],
    step(next, c) { this.pc = next; this.cycles += c; this.pcSeq.push(next); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
  };
}

test("loc_de1b: $01ca==0 && $01c7==0 -> beq $de6b -> rts (early exit)", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> pulled + 1 = 0x1234
  m.mem.write8(0x01ca, 0x00);
  m.mem.write8(0x01c7, 0x00);

  loc_de1b(m);

  assert.equal(m.mem.read8(0x6040), 0x00, "de6d sty $6040 = 0");
  assert.equal(m.regs.a, 0x00, "de70 lda $01ca = 0 -> A=0");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  // 4+2+4+3 (de1b/de1e/de20/de23) + 2+4+4+2 (de6b/de6d/de70/de73) + 6 (de75 rts)
  assert.equal(m.cycles, 31, "de1b lda + bne + lda + beq + de6b block + rts");
});

test("loc_de1b: init-skip, asl carry-set -> de7f -> $01ca=0x40, bvc $deff, Y=0x0e exits rts", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000);
  m.mem.write8(0x01ca, 0x80); // de1e bne skips init; de7c asl 0x80 -> C set, result 0
  m.mem.write8(0x01cb, 0x05);
  m.mem.write8(0x01cc, 0x03); // X for sta $6000,x

  loc_de1b(m);

  assert.equal(m.mem.read8(0x6003), 0x00, "de7f sta $6000,x (A = asl 0x80 = 0)");
  assert.equal(m.mem.read8(0x01ca), 0x40, "de84 sta #$40 -> $01ca");
  assert.equal(m.mem.read8(0x6040), 0x0e, "deff sty $6040 = Y (0x0e from de87)");
  assert.equal(m.regs.a, 0x0e, "df02 tya -> A = 0x0e");
  assert.equal(m.regs.y, 0x0e, "Y = 0x0e");
  assert.equal(m.pc, 0x2001, "df03 bne (Y!=0) -> df08 rts");
  assert.equal(m.cycles, 65, "init-skip -> de7f -> bvc deff -> tya bne rts");
});

test("loc_de1b: init-skip, asl carry-clear N-set -> de8e path (beq $de9c, bcc not taken) -> bvc $def2", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x3000);
  m.mem.write8(0x01ca, 0x40); // asl 0x40 -> 0x80: C clear (bcc taken de8c), N set (bpl not taken de8e)
  m.mem.write8(0x01cb, 0x02); // Y
  m.mem.write8(0x01cc, 0x05); // X (>= 01cd, so dea1 bcc not taken)
  m.mem.write8(0x01cd, 0x03);
  m.mem.write8(0x01c6, 0x00); // de96 beq $de9c taken
  m.mem.write8(0x01cf, 0x10);
  m.mem.write8(0x00bd, 0x00); m.mem.write8(0x00be, 0x04); // ($bd) -> 0x0400
  m.mem.write8(0x0402, 0x55); // (bd),y read at de9c (y=2)

  loc_de1b(m);

  assert.equal(m.mem.read8(0x01ca), 0x00, "dea5 sta #0 -> $01ca (x>=01cd path)");
  assert.equal(m.mem.read8(0x6005), 0x10, "deab sta $6000,x = $01cf (0x10), X=5");
  assert.equal(m.mem.read8(0x01cf), 0x20, "def3 adc: 0x10 + 0x10 = 0x20 -> $01cf");
  assert.equal(m.mem.read8(0x01cb), 0x03, "def9 inc $01cb: 2 -> 3");
  assert.equal(m.mem.read8(0x01cc), 0x06, "defc inc $01cc: 5 -> 6");
  assert.equal(m.mem.read8(0x6040), 0x0c, "deff sty $6040 = Y (0x0c from deae)");
  assert.equal(m.regs.a, 0x0c, "df02 tya -> A = 0x0c");
  assert.equal(m.pc, 0x3001, "df03 bne (Y!=0) -> df08 rts");
  assert.equal(m.cycles, 118, "de8e path with beq de9c + bcc-not-taken + def2 tail");
});

test("loc_de1b: outer loop -- deb3 element loop 3 passes (deee, then ded8 clear + dee6, then de6b rts)", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x4000);
  m.mem.write8(0x01ca, 0x20); // asl 0x20 -> 0x40: C clear, N clear -> bpl taken deb3
  m.mem.write8(0x01c7, 0x00); // pass3: de23 beq $de6b -> rts
  m.mem.write8(0x01cb, 0x02);
  m.mem.write8(0x01cc, 0x04);
  m.mem.write8(0x01cd, 0x05); // pass1 X=4<5 (bcc deee); pass2 X=5>=5 (dece)
  m.mem.write8(0x01cf, 0x30);
  m.mem.write8(0x01ce, 0x11);
  m.mem.write8(0x01c9, 0x02);
  m.mem.write8(0x6050, 0x60); // dec9 lda $6050
  m.mem.write8(0x00bd, 0x00); m.mem.write8(0x00be, 0x04); // ($bd) -> 0x0400

  loc_de1b(m);

  assert.equal(m.mem.read8(0x6004), 0x08, "pass1 deb8 sta $6000,x (X=4) = 8");
  assert.equal(m.mem.read8(0x6005), 0x08, "pass2 deb8 sta $6000,x (X=5) = 8");
  assert.equal(m.mem.read8(0x0402), 0x00, "pass1 wrote 0x60 at 0x0402, pass2 ded8 cleared it");
  assert.equal(m.mem.read8(0x0400), 0x00, "pass2 ded8 clears (bd),y down to 0");
  assert.equal(m.mem.read8(0x01cf), 0x90, "pass1 adc 0x60+0x30=0x90; pass2 adc 0+0x90=0x90");
  assert.equal(m.mem.read8(0x01c9), 0x13, "pass2 dee0 ora: 0x11 | 0x02 = 0x13 -> $01c9");
  assert.equal(m.mem.read8(0x01ca), 0x00, "pass2 dee6 sta #0 -> $01ca");
  assert.equal(m.mem.read8(0x01cb), 0x04, "inc $01cb over 2 passes: 2 -> 4");
  assert.equal(m.mem.read8(0x01cc), 0x06, "inc $01cc over 2 passes: 4 -> 6");
  assert.equal(m.pc, 0x4001, "pass3 de73 bne not taken -> de75 rts");
  assert.equal(m.cycles, 328, "pass1 (113) + pass2 (184) + pass3 (31)");
});
