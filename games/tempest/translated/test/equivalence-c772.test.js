// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_c772 (ROM 0xc772) and its second entry loc_c774. Emits a {0x40,0x80} header then
// two coordinate words from ($02/$03,x) and ($00/$01,x), then tail-jmps df5f. Minimal 6502 harness with
// recorded calls[]. Run: node --test games/tempest/translated/test/equivalence-c772.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_c772, loc_c774 } from "../loc_c772.js";

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

// coordinate source: $00-$03 indexed by x=0
function seedCoords(m) {
  m.ram[0x00] = 0xbb; // -> $6a, y-slot lo
  m.ram[0x01] = 0xe5; // -> $6b, &1f = 0x05
  m.ram[0x02] = 0xaa; // -> $6c
  m.ram[0x03] = 0xe3; // -> $6d, &1f = 0x03
}

test("loc_c774: y preserved (=2) -> writes header+coords at ($74),2..7, caches $6a-$6d, jmp df5f, 85 T", () => {
  const m = makeMachine();
  m.regs.x = 0x00;
  m.regs.y = 0x02; // as if entered from c765
  m.ram[0x74] = 0x00; m.ram[0x75] = 0x60; // ($74) -> 0x6000
  seedCoords(m);

  loc_c774(m);

  assert.equal(m.ram[0x6002], 0x40, "header lo = 0x40");
  assert.equal(m.ram[0x6003], 0x80, "header hi = 0x80");
  assert.equal(m.ram[0x6004], 0xaa, "($74),4 = $02,x");
  assert.equal(m.ram[0x6005], 0x03, "($74),5 = $03,x & 0x1f");
  assert.equal(m.ram[0x6006], 0xbb, "($74),6 = $00,x");
  assert.equal(m.ram[0x6007], 0x05, "($74),7 = $01,x & 0x1f");
  assert.equal(m.ram[0x6c], 0xaa, "$6c cached (raw $02,x)");
  assert.equal(m.ram[0x6d], 0xe3, "$6d cached raw (pre-mask)");
  assert.equal(m.ram[0x6a], 0xbb, "$6a cached (raw $00,x)");
  assert.equal(m.ram[0x6b], 0xe5, "$6b cached raw (pre-mask)");
  assert.deepEqual(m.calls, [0xdf5f], "tail-jmp df5f");
  assert.equal(m.pc, 0xdf5f, "pc at df5f");
  assert.equal(m.cycles, 85, "c774 body total");
});

test("loc_c772: entry zeros y first -> word slots at ($74),0..5, jmp df5f, 87 T", () => {
  const m = makeMachine();
  m.regs.x = 0x00;
  m.regs.y = 0xff; // will be overwritten by ldy #$00
  m.ram[0x74] = 0x00; m.ram[0x75] = 0x60;
  seedCoords(m);

  loc_c772(m);

  assert.equal(m.ram[0x6000], 0x40, "header lo at slot 0");
  assert.equal(m.ram[0x6001], 0x80, "header hi at slot 1");
  assert.equal(m.ram[0x6002], 0xaa, "($74),2 = $02,x");
  assert.equal(m.ram[0x6003], 0x03, "($74),3 = $03,x & 0x1f");
  assert.equal(m.ram[0x6004], 0xbb, "($74),4 = $00,x");
  assert.equal(m.ram[0x6005], 0x05, "($74),5 = $01,x & 0x1f");
  assert.deepEqual(m.calls, [0xdf5f], "tail-jmp df5f");
  assert.equal(m.pc, 0xdf5f, "pc at df5f");
  assert.equal(m.cycles, 87, "ldy #0 (2) + c774 body (85)");
});
