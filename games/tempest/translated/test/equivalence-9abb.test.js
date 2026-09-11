// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9abb / loc_9aee (ROM 0x9abb-0x9afc) -- the POKEY-random slot picker.
// loc_9abb reads POKEY RANDOM (0x60ca); this test seeds it via harness mem (deterministic).
// Run: node --test games/tempest/translated/test/equivalence-9abb.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9abb } from "../loc_9abb.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = { read8: (a) => ram[a & 0xffff], write8: (a, v) => { ram[a & 0xffff] = v & 0xff; } };
  return {
    regs, mem, ram, cycles: 0, pc: 0, calls: [],
    step(n, c) { this.pc = n; this.cycles += c; },
    call(t) { this.calls.push(t); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
  };
}
// The list-hi / list-lo tables that sit right after the rts (0x9afd.., 0x9b02..).
function seedTables(m) {
  m.mem.write8(0x9afd, 0x07); m.mem.write8(0x9afe, 0x72); m.mem.write8(0x9aff, 0x07);
  m.mem.write8(0x9b00, 0x00); m.mem.write8(0x9b01, 0x61); m.mem.write8(0x9b02, 0x40);
  m.mem.write8(0x9b03, 0x00); m.mem.write8(0x9b04, 0x41); m.mem.write8(0x9b05, 0x40);
}

test("loc_9abb: qualifying slot on first probe builds $2c/$2d/$2b and returns A=$29", () => {
  const m = makeMachine(); seedTables(m); m.push16(0x1234); m.regs.x = 0x09;
  m.mem.write8(0x60ca, 0x02);   // RANDOM & 3 = 2 -> initial Y
  m.mem.write8(0x014a, 0x00);   // 0x0149[Y=1] -> slot 0 (not 3)
  m.mem.write8(0x013c, 0x55);   // 0x013c[0] != 0 -> qualifies, exits loop
  m.mem.write8(0x29, 0x99);
  loc_9abb(m);
  assert.equal(m.mem.read8(0x2c), 0x40, "$2c = (slot|0x40)");
  assert.equal(m.mem.read8(0x2d), 0x07, "$2d = 0x9afd[Y=2] = 0x07");
  assert.equal(m.mem.read8(0x2b), 0x02, "$2b = Y = 2");
  assert.equal(m.regs.a, 0x99, "A = $29");
  assert.equal(m.regs.x, 0x09, "X restored from $39");
  assert.equal(m.regs.y, 0x02);
  assert.equal(m.pc, 0x1235, "rts -> pushed return + 1");
  assert.equal(m.cycles, 80, "exact cycle total, in-page probe");
});

test("loc_9abb: all slots empty -> $2b underflows -> A=0, X restored (loop + branch polarity)", () => {
  const m = makeMachine(); seedTables(m); m.push16(0x1234); m.regs.x = 0x09;
  m.mem.write8(0x60ca, 0x00);   // Y starts 0; every 0x0149[y]=0, 0x013c[0]=0 -> never qualifies
  loc_9abb(m);
  assert.equal(m.regs.a, 0x00, "A = 0 (no slot qualified)");
  assert.equal(m.regs.x, 0x09, "X restored from $39");
  assert.equal(m.regs.y, 0x00, "Y after four decrements+wraps");
  assert.equal(m.pc, 0x1235, "rts");
  assert.equal(m.cycles, 151, "exact: 4 empty probes + underflow exit");
});

test("loc_9abb MUTATION: cpx #3 -> slot 3 redirects to index 5 (0x013c[5])", () => {
  const m = makeMachine(); seedTables(m); m.push16(0x1234); m.regs.x = 0x07;
  m.mem.write8(0x60ca, 0x02);   // Y starts 2 -> first probe Y=1
  m.mem.write8(0x014a, 0x03);   // 0x0149[1] = 3 -> ldx #5 redirect
  m.mem.write8(0x013c + 5, 0x88); // slot at index 5 non-empty -> qualifies
  m.mem.write8(0x29, 0x44);
  loc_9abb(m);
  // qualifying A = 0x0149[Y] | 0x40 = 0x03 | 0x40 = 0x43
  assert.equal(m.mem.read8(0x2c), 0x43, "$2c uses raw 0x0149[Y], not the redirected index");
  assert.equal(m.regs.a, 0x44, "A = $29");
  assert.equal(m.pc, 0x1235);
});
