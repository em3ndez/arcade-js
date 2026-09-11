// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a06f (ROM 0xa06f). Path 1: match at $0202 and ($0283,y&7)!=4 -> dec $0109,
// then ($028a,y&3)==0 -> rts (no draw). Path 2: mismatch -> dec $0108, then the draw setup that calls
// loc_9b07 + 0x994d twice (994d opaque; the override clears Z so the second draw runs).
// Run: node --test games/tempest/translated/test/equivalence-a06f.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a06f } from "../loc_a06f.js";

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

test("loc_a06f: match + ($0283,y&7)!=4 -> dec $0109, ($028a,y&3)==0 -> rts, no draw; 77 T", () => {
  const m = makeMachine();
  m.regs.y = 0x00;
  m.regs.x = 0x77;
  m.regs.s = 0xfd;
  m.push16(0x5000); // final rts -> 0x5001
  m.ram[0x02df] = 0x05;  // slot -> $29
  m.ram[0x0202] = 0x05;  // equal -> bne not taken
  m.ram[0x0283] = 0x02;  // &7 = 2 != 4 -> beq not taken
  m.ram[0x0109] = 0x10;
  m.ram[0x0108] = 0x20;
  m.ram[0x0142 + 2] = 0x30; // dec target: (0x0283&7)=2 -> $0144
  m.ram[0x028a] = 0x00;  // &3 = 0 -> beq 0xa0f6 (rts, no draw)
  loc_a06f(m);
  assert.equal(m.ram[0x29], 0x05, "slot saved to $29");
  assert.equal(m.ram[0x0109], 0x0f, "dec $0109 (match + tag!=4 branch)");
  assert.equal(m.ram[0x0108], 0x20, "$0108 untouched on this branch");
  assert.equal(m.ram[0x02df], 0x00, "slot $02df,y cleared");
  assert.equal(m.ram[0x0144], 0x2f, "dec $0142,x with x = tag = 2");
  assert.equal(m.ram[0x35], 0x77, "stx $35 saved X; ldx $35 restored it");
  assert.equal(m.regs.x, 0x77, "X restored");
  assert.deepEqual(m.calls, [], "no draw calls -- ($028a,y&3)==0 rts");
  assert.equal(m.pc, 0x5001, "final rts -> pushed + 1");
  assert.equal(m.cycles, 77, "golden T-state total for the no-draw path");
});

test("loc_a06f: mismatch -> dec $0108, draw setup calls loc_9b07 then 0x994d twice; 156 T", () => {
  const m = makeMachine();
  m.regs.y = 0x00;
  m.regs.x = 0x00;
  m.regs.s = 0xfd;
  m.push16(0x5000);
  m.ram[0x02df] = 0x05;  // -> $29
  m.ram[0x0202] = 0x09;  // != 0x05 -> bne taken -> dec $0108
  m.ram[0x0108] = 0x20;
  m.ram[0x0283] = 0x00;  // &7 = 0 -> tax x=0 -> dec $0142
  m.ram[0x0142] = 0x30;
  m.ram[0x028a] = 0x01;  // &3 = 1 -> not beq -> draw path
  // a0a4: sec; sbc #1 -> 0x01-1 = 0x00; cmp #2 -> !=2 -> bne a0ad (skip lda #4). $2b = 0x00.
  m.ram[0x02b9] = 0x03;  // a0af: -1 = 2; &0f = 2; cmp #0f -> C clear -> bcc a0c2 (skip bit). $2a = 2.
  m.ram[0x2d] = 0x03;    // -> $010b = 3 -> dec -> 2
  const realCall = m.call.bind(m);
  m.call = (a) => { if (a === 0x994d) m.regs.fZ = false; return realCall(a); }; // 994d result nonzero -> beq not taken
  loc_a06f(m);
  assert.equal(m.ram[0x0108], 0x1f, "dec $0108 (mismatch branch)");
  assert.equal(m.ram[0x0142], 0x2f, "dec $0142,x with x=0");
  assert.equal(m.ram[0x2b], 0x40, "$2b = 0x00 then ora #0x40 = 0x40");
  assert.equal(m.ram[0x2a], 0x04, "$2a: 0x02 then +2 = 0x04");
  assert.equal(m.ram[0x010b], 0x02, "$010b = $2d(3) - 1 = 2");
  assert.equal(m.ram[0x010a], 0x00, "$010a cleared");
  assert.deepEqual(m.calls, [0x9b07, 0x994d, 0x994d], "loc_9b07 then two draws via 0x994d");
  assert.equal(m.pc, 0x5001, "final rts -> pushed + 1");
  assert.equal(m.cycles, 156, "golden T-state total for the full draw path");
});
