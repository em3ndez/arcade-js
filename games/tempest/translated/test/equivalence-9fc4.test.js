// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9fc4 (ROM 0x9fc4-0xa027) -- per-slot(x) approach step: seeds/min-tracks the
// segment depth table $03ac,y, clamps depth at $20 (forcing $028a,x bit7), and on depth >= $f2 picks a new
// segment (jsr $a028) then optionally rewrites $028a,x/$0283,x. Delegates the jsr via m.call.
// Run: node --test games/tempest/translated/test/equivalence-9fc4.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9fc4 } from "../loc_9fc4.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, calls: [],
    step(next, c) { this.pc = next; this.cycles += c; },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    // record the JSR's pushed return address (must be jsraddr+2) so a wrong push16 fails, then pop to balance S
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; (this.retAddrs ||= []).push(this.pull16()); } return undefined; },
  };
}

// depth < $20: column already seeded, not a new min -> force $028a,x bit7, clamp depth to $20 (9fed path)
test("depth < $20 -> ora bit7, clamp $02df,x to $20, bvc a027", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000); m.regs.x = 0x00;
  m.ram[0x02b9] = 0x03;   // segment col 3 -> $03ac,y = $03af
  m.ram[0x03af] = 0x05;   // nonzero -> bne 9fcf taken (skip seed)
  m.ram[0x02df] = 0x10;   // depth 0x10 >= 0x05 (bcs 9fdc: not a new min); < 0x20
  m.ram[0x028a] = 0x00;
  loc_9fc4(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x010c], 0x01, "$010c set to 1 at entry, untouched on this path");
  assert.equal(m.ram[0x028a], 0x80, "bit7 forced (ora #$80)");
  assert.equal(m.ram[0x02df], 0x20, "depth clamped to $20");
  assert.equal(m.ram[0x03af], 0x05, "column depth unchanged (not a new min)");
  assert.equal(m.pc, 0x5001, "rts -> pushed return + 1");
  assert.equal(m.cycles, 66);
});

// column depth 0 -> seed $f1; then a new min ($02df,x < seeded) -> store min + tag $039a,y; depth in [$20,$f2)
test("seed $f1 when depth 0, then new min tag $039a,y, bcc a027 end", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000); m.regs.x = 0x00;
  m.ram[0x02b9] = 0x03;
  m.ram[0x03af] = 0x00;   // zero -> bne 9fcf NOT taken -> seed $03af = $f1
  m.ram[0x02df] = 0x50;   // 0x50 < 0xf1 -> new min; 0x50 in [$20,$f2) -> bcc a027 end
  loc_9fc4(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x03af], 0x50, "column depth := new min $02df,x");
  assert.equal(m.ram[0x039d], 0x80, "new-min tag $039a,y = $80");
  assert.equal(m.ram[0x02df], 0x50, "depth unchanged on this path");
  assert.equal(m.ram[0x010c], 0x01);
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 65);
});

// depth >= $f2 -> jsr $a028 (delegated), park depth $f0; $03ab==0 -> rewrite $028a,x low2 and $0283,x low3
test("depth >= $f2 -> jsr $a028, $03ab==0 rewrite path clears $010c", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000); m.regs.x = 0x00;
  m.ram[0x02b9] = 0x02;   // $03ac,y = $03ae
  m.ram[0x03ae] = 0xff;   // nonzero -> skip seed
  m.ram[0x02df] = 0xf5;   // < 0xff -> new min; >= 0x20; >= 0xf2 -> jsr $a028
  m.ram[0x028a] = 0x00; m.ram[0x0283] = 0x00; m.ram[0x03ab] = 0x00;
  loc_9fc4(m);
  assert.deepEqual(m.calls, [0xa028]);
  assert.equal(m.retAddrs[0], 0xa003, "jsr $a028 pushes addr+2 (0xa001+2)");
  assert.equal(m.ram[0x02df], 0xf0, "depth parked at $f0");
  assert.equal(m.ram[0x028a], 0x01, "$028a,x low2 -> %01 (and #$fc ora #$01)");
  assert.equal(m.ram[0x0283], 0x02, "$0283,x low3 -> %010 (and #$f8 ora #$02)");
  assert.equal(m.ram[0x03ae], 0xf5, "column depth := new min before the jsr");
  assert.equal(m.ram[0x039c], 0x80, "new-min tag set");
  assert.equal(m.ram[0x010c], 0x00, "$010c cleared on the rewrite path");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 109);
});

// depth >= $f2 -> jsr $a028, park $f0, but $03ab != 0 -> bne a027, $010c stays 1 (no rewrite)
test("depth >= $f2 -> jsr $a028, $03ab != 0 -> end, no rewrite", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000); m.regs.x = 0x00;
  m.ram[0x02b9] = 0x02; m.ram[0x03ae] = 0xff; m.ram[0x02df] = 0xf5; m.ram[0x03ab] = 0x01;
  loc_9fc4(m);
  assert.deepEqual(m.calls, [0xa028]);
  assert.equal(m.retAddrs[0], 0xa003);
  assert.equal(m.ram[0x02df], 0xf0, "depth parked at $f0");
  assert.equal(m.ram[0x010c], 0x01, "$010c stays 1 (rewrite skipped)");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 78);
});

// page-cross edge: x=0x80 pushes the abs,x loads into page 0x03 (+1 each); depth<$20 path like test 1
test("edge: abs,x page cross adds +1 per crossing load (depth<$20 path)", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000); m.regs.x = 0x80;
  m.ram[0x0339] = 0x03;   // $02b9,x = 0x0339 (crosses); segment col 3
  m.ram[0x03af] = 0x05;   // $03ac,y = $03af (no cross, y=3)
  m.ram[0x035f] = 0x10;   // $02df,x = 0x035f (crosses)
  m.ram[0x030a] = 0x00;   // $028a,x = 0x030a (crosses)
  loc_9fc4(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x030a], 0x80, "bit7 forced at $028a,x");
  assert.equal(m.ram[0x035f], 0x20, "depth clamped at $02df,x");
  assert.equal(m.cycles, 70, "test1 66 + 4 crossing abs,x loads");
});
