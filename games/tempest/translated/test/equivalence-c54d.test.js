// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_c54d (ROM 0xc54d-0xc5c1). jsr $df4c and jsr $bd09 are opaque (harness records
// the calls, balances the stack). Covers: $0115==0 short path, the tail inc, an all-zero loop (pha/pla
// balance), and one active pass through each $9e-select branch. Author-derived.
// Run: node --test games/tempest/translated/test/equivalence-c54d.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_c54d } from "../loc_c54d.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, pcSeq: [], calls: [], _retPushed: false,
    step(next, c) { this.pc = next; this.cycles += c; this.pcSeq.push(next); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; this.pull16(); } return undefined; },
  };
}

test("loc_c54d: $0115==0 and $011f==0 -> straight to rts, no calls, 20 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0xca00); m._retPushed = false;
  m.ram[0x0115] = 0x00;
  m.ram[0x011f] = 0x00;
  loc_c54d(m);
  assert.deepEqual(m.calls, [], "no jsr");
  assert.equal(m.pc, 0xca01, "rts -> caller + 1");
  assert.equal(m.cycles, 4 + 3 + 4 + 3 + 6, "lda + beq(taken) + lda + beq(taken) + rts = 20");
});

test("loc_c54d: $0115==0, tail inc $0200,$40 when $011f set and $42>=0x15, 36 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0xca00); m._retPushed = false;
  m.ram[0x0115] = 0x00;
  m.ram[0x011f] = 0x01;
  m.ram[0x42] = 0x20; // >= 0x15 -> bcc not taken
  m.ram[0x40] = 0x03; // inc target index
  m.ram[0x0203] = 0x41;
  loc_c54d(m);
  assert.equal(m.ram[0x0203], 0x42, "inc $0200,$40");
  assert.equal(m.pc, 0xca01, "rts");
  assert.equal(m.cycles, 4 + 3 + 4 + 2 + 3 + 2 + 2 + 3 + 7 + 6, "36 T");
});

test("loc_c54d: $011f set but $42<0x15 -> no inc", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0xca00); m._retPushed = false;
  m.ram[0x0115] = 0x00;
  m.ram[0x011f] = 0x01;
  m.ram[0x42] = 0x10; // < 0x15 -> bcc taken -> rts
  m.ram[0x40] = 0x03;
  m.ram[0x0203] = 0x41;
  loc_c54d(m);
  assert.equal(m.ram[0x0203], 0x41, "no inc (index below threshold)");
});

test("loc_c54d: $0115 set, all $03fe entries zero -> loop skips body, pha/pla restore, no calls", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0xca00); m._retPushed = false;
  m.ram[0x0115] = 0x01;
  m.ram[0x011f] = 0x00;
  m.ram[0x5f] = 0x11; m.ram[0x5b] = 0x22; m.ram[0xa0] = 0x33; // saved + restored
  // $03fe..$0405 already zero -> every pass beq-skips
  loc_c54d(m);
  assert.deepEqual(m.calls, [], "no jsr when all entries zero");
  assert.equal(m.ram[0x5f], 0x11, "$5f restored by pla");
  assert.equal(m.ram[0x5b], 0x22, "$5b restored by pla");
  assert.equal(m.ram[0xa0], 0x33, "$a0 restored by pla");
  assert.equal(m.regs.s, 0xfd, "stack balanced");
  assert.equal(m.pc, 0xca01, "rts");
  // TEETH: lda 0x03fe,x (abs,x, base 0x03fe hi=0x03) crosses $0400 for x>=2, forcing +1T.
  // Loop runs x=7..0: passes x=7..2 cross (+1T each = 6 extra T), x=1,0 do not.
  // Pre-loop 44 + loop 149 + restore 21 + tail 13 = 227. With the page-cross bug it would be 221.
  assert.equal(m.cycles, 227, "all-zero loop total incl. forced +1T page-cross on x>=2");
});

test("loc_c54d: active pass, $9f<5 -> $9e=6, and jsr $df4c/$bd09 recorded", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0xca00); m._retPushed = false;
  m.ram[0x0115] = 0x01;
  m.ram[0x011f] = 0x00;
  m.ram[0x9f] = 0x00;          // < 5 -> lda #$06 route
  m.ram[0x03fe + 0x07] = 0x40; // only the x=7 pass is active
  loc_c54d(m);
  assert.equal(m.ram[0x57], 0x40, "$57 <- active entry");
  assert.equal(m.ram[0x56], 0x80, "$56 = 0x80");
  assert.equal(m.ram[0x58], 0x80, "$58 = 0x80");
  assert.equal(m.ram[0x9e], 0x06, "$9e = 6 ($9f<5 route)");
  // $55 = (($37 & 3) << 1) + 0x0a, with $37 = 7 -> (3<<1)+0x0a = 0x10
  assert.equal(m.ram[0x55], 0x10, "$55 = ((7&3)<<1)+0x0a");
  assert.deepEqual(m.calls, [0xdf4c, 0xbd09], "both jsr targets recorded");
});

test("loc_c54d: active pass, $9f>=5 and x&7==7 -> $9e=4", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0xca00); m._retPushed = false;
  m.ram[0x0115] = 0x01;
  m.ram[0x011f] = 0x00;
  m.ram[0x9f] = 0x10;          // >= 5 -> txa/and/cmp route
  m.ram[0x03fe + 0x07] = 0x55; // x=7 -> 7 & 7 == 7 -> bne not taken -> lda #$04
  loc_c54d(m);
  assert.equal(m.ram[0x9e], 0x04, "$9e = 4 (x&7 == 7 route)");
  assert.deepEqual(m.calls, [0xdf4c, 0xbd09], "both jsr targets recorded");
});

test("loc_c54d: active pass, $9f>=5 and x&7!=7 -> $9e = x&7", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0xca00); m._retPushed = false;
  m.ram[0x0115] = 0x01;
  m.ram[0x011f] = 0x00;
  m.ram[0x9f] = 0x10;          // >= 5
  m.ram[0x03fe + 0x06] = 0x55; // x=6 -> 6 & 7 == 6 != 7 -> bne taken -> A stays 6
  loc_c54d(m);
  assert.equal(m.ram[0x9e], 0x06, "$9e = x & 7 = 6");
});
