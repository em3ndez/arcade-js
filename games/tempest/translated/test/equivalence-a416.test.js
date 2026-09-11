// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a416 (ROM 0xa416-0xa447). If the $0116 dirty flag is 0 it returns at once; else
// clears it and advances each active slot's $0312 timer by table a44e[type], expiring it at a448[type].
// Run: node --test games/tempest/translated/test/equivalence-a416.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a416 } from "../loc_a416.js";

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

test("loc_a416: flag $0116 == 0 -> immediate rts, no slot touched, 13 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x1b00);
  m.ram[0x0116] = 0x00;
  loc_a416(m);
  assert.equal(m.ram[0x0116], 0x00, "flag untouched");
  assert.deepEqual(m.calls, [], "no calls");
  assert.equal(m.pc, 0x1b01, "rts -> pushed + 1");
  assert.equal(m.cycles, 13, "lda4 + beq3 + rts6");
});

test("loc_a416: one active slot advances under limit -> re-set $0116, 146 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x1b00);
  m.ram[0x0116] = 0x01;      // dirty -> enter loop, then cleared
  m.ram[0x030d] = 0x01;      // only slot 3 active ($030a,3)
  m.ram[0x0315] = 0x10;      // $0312,3 current timer
  m.ram[0x0305] = 0x02;      // $0302,3 type = 2
  m.ram[0xa450] = 0x05;      // a44e[2] step
  m.ram[0xa44a] = 0x20;      // a448[2] limit
  loc_a416(m);
  assert.equal(m.ram[0x0315], 0x15, "0x10 + 0x05 = 0x15 written back");
  assert.equal(m.ram[0x030d], 0x01, "slot stays active (under limit)");
  assert.equal(m.ram[0x0116], 0x01, "$0116 re-set once (still animating)");
  assert.equal(m.pc, 0x1b01, "rts -> pushed + 1");
  assert.equal(m.cycles, 146, "7 skipped slots + 1 advanced slot");
});

test("loc_a416: slot reaches limit -> cleared, $0116 not re-set, 151 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x1b00);
  m.ram[0x0116] = 0x01;
  m.ram[0x030d] = 0x01;      // slot 3 active
  m.ram[0x0315] = 0x1e;      // timer near limit
  m.ram[0x0305] = 0x02;      // type 2
  m.ram[0xa450] = 0x05;      // step -> 0x1e + 0x05 = 0x23
  m.ram[0xa44a] = 0x20;      // limit 0x20 -> 0x23 >= limit -> expire
  loc_a416(m);
  assert.equal(m.ram[0x0315], 0x23, "timer advanced past the limit");
  assert.equal(m.ram[0x030d], 0x00, "slot cleared on expiry");
  assert.equal(m.ram[0x0116], 0x00, "$0116 stays clear (not re-set)");
  assert.equal(m.cycles, 151, "expiry branch is longer than the re-set branch");
});
