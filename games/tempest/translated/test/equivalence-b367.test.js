// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b367 (ROM 0xb367-0xb475). Minimal 6502 harness (Regs + flat RAM + the page-1
// stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration check.
// The JSRs (b2be/c30d/b2fe/b2de) are opaque here (harness records the call, balances the stack, does not
// run them). The abs,x index tables at 0xb476/0xb487 and the (0x3b)/(0xb0) pointers live in this flat RAM,
// so the test controls them. Run: node --test games/tempest/translated/test/equivalence-b367.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b367 } from "../loc_b367.js";

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

// Identity index tables + fixed indirect pointers used by both loops.
function wireTables(m) {
  m.ram[0x003b] = 0x00; m.ram[0x003c] = 0x50; // (0x3b),y -> 0x5000 + b476[x]
  m.ram[0x00b0] = 0x00; m.ram[0x00b1] = 0x60; // (0xb0),y -> 0x6000 + b487[x]
  for (let x = 0; x <= 0x0f; x++) { m.ram[0xb476 + x] = x; m.ram[0xb487 + x] = 0x10 + x; }
}

test("loc_b367: skip path -- $0114=0 skips the first block, $0106<0 skips the enemy loop", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x9abb); // rts -> 0x9abc
  m.ram[0x0114] = 0x00; // beq -> skip b36c..b376 (only b2de is called)
  m.ram[0x0106] = 0x80; // bmi -> skip loop2
  m.ram[0x0125] = 0x00; // beq -> A stays 0x06 for sta 0x29
  m.ram[0x0202] = 0x00; // beq -> $2a/$2b stay 0xff
  m.ram[0x0124] = 0x80; // bmi (b408) skips shift; also loop3 b437 bmi -> b449
  m.ram[0x0111] = 0x00; // bpl -> x stays 0x0f in loop4 (no dex)
  wireTables(m);
  for (let a = 0x6010; a <= 0x601f; a++) m.ram[a] = 0x00; // (0xb0),y source cells

  loc_b367(m);

  assert.deepEqual(m.calls, [0xb2de], "only jsr $b2de runs (first block skipped by beq)");
  assert.equal(m.ram[0x29], 0x06, "$29 = 0x06 (A from lda #$06, $0125=0 skips to sta)");
  assert.equal(m.ram[0x2a], 0xff, "$2a = 0xff (X unchanged, $0202=0)");
  assert.equal(m.ram[0x2b], 0xff, "$2b = 0xff (Y unchanged, $0202=0)");
  assert.equal(m.ram[0x2c], 0xff, "$2c = 0xff (stx #$ff, $0124<0 skips the lsr store)");
  // loop3: every entry $0425,x==0 -> b427; X != $2a/$2b -> b434; $0124<0 -> b449 -> Y=$29=6 -> A=6
  assert.equal(m.ram[0x5000], 0x06, "(0x3b),y write at b476[0]=0 -> 0x5000 = 0x06");
  assert.equal(m.ram[0x500f], 0x06, "(0x3b),y write at b476[0x0f]=0x0f -> 0x500f = 0x06");
  // loop4: $0425,x==0 (bit7 clear) -> Y=0xc0 -> $58=0xc0; (src&0x1f)|0xc0
  assert.equal(m.ram[0x6010], 0xc0, "(0xb0),y merge at b487[0]=0x10 -> 0x6010 = (0|0x1f)&... |0xc0 = 0xc0");
  assert.equal(m.ram[0x601f], 0xc0, "(0xb0),y merge at b487[0x0f]=0x1f -> 0x601f = 0xc0");
  assert.equal(m.ram[0x0425], 0x00, "flag block stays cleared (loop2 skipped)");
  assert.equal(m.ram[0x0434], 0x00, "flag block tail stays cleared");
  assert.equal(m.pc, 0x9abc, "rts returns to pushed + 1");
  // start 7 + b379-blk 8 + 4 + clear-loop 159 + b388-blk 7 + b3d6-blk 9 + b3e9-blk 17
  // + b401-blk 13 + b412 2 + loop3 751 + b454-blk 9 + loop4 591 + rts 6
  const clearLoop = 16 * (5 + 2) + (15 * 3 + 2);          // 159
  const loop3 = 16 * 44 + (15 * 3 + 2);                    // 751
  const loop4 = 16 * 34 + (15 * 3 + 2);                    // 591
  assert.equal(
    m.cycles,
    (4 + 3) + (2 + 6) + (2 + 2) + clearLoop + (4 + 3) + (2 + 4 + 3) +
      (3 + 2 + 2 + 3 + 4 + 3) + (3 + 3 + 4 + 3) + 2 + loop3 + (2 + 4 + 3) + loop4 + 6,
    "T-state total 1583",
  );
  assert.equal(m.cycles, 1583, "explicit golden 1583 T");
});

test("loc_b367: active path -- $0114!=0 runs all 4 jsrs; loop2 builds a flag-block entry", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1234); // rts -> 0x1235
  m.ram[0x0114] = 0x01; // beq NOT taken -> b2be, c30d, b2fe, then b2de
  m.ram[0x0106] = 0x00; // bmi NOT taken -> loop2 runs
  m.ram[0x011c] = 0x00; // X=0: one index, then dex->0xff exits loop2
  m.ram[0x02df + 0x00] = 0x20; // enemy present (nonzero)
  m.ram[0x0283 + 0x00] = 0x01; // &7 == 1 (passes cmp), bit7 clear
  m.ram[0x0148] = 0x00; // bmi NOT taken
  m.ram[0x0157] = 0x40; // 0x20 < 0x40 -> carry clear -> inc $29 twice
  m.ram[0x02cc + 0x00] = 0x05; // $0425+5 gets A
  m.ram[0x02b9 + 0x00] = 0x06; // $0425+6 gets A|0x80
  m.ram[0x0125] = 0x00; // beq -> A=0x06 -> $29 reset to 6 (b3e9 sta)
  m.ram[0x0202] = 0x00; m.ram[0x0124] = 0x80; m.ram[0x0111] = 0x00;
  wireTables(m);

  loc_b367(m);

  assert.deepEqual(
    m.calls,
    [0xb2be, 0xc30d, 0xb2fe, 0xb2de],
    "all four jsr targets run in order (first block not skipped)",
  );
  // loop2: iny=1, sta $29; +inc twice = 3; b3bb: $0425[5] |= 3 -> 0x03
  assert.equal(m.ram[0x042a], 0x03, "$0425 + $02cc[0](=5) merged with $29(=3) -> 0x03");
  // b3c6: $0425[6] |= ($29 | 0x80) = 0x83
  assert.equal(m.ram[0x042b], 0x83, "$0425 + $02b9[0](=6) merged with $29|0x80 -> 0x83");
  assert.equal(m.ram[0x29], 0x06, "$29 overwritten to 0x06 by b3e9 (post-loop2)");
  assert.equal(m.pc, 0x1235, "rts returns to pushed + 1");
});

test("loc_b367: b3df branch -- $0125 active and ($03 & 7)==7 sets $29 = 1", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x0000);
  m.ram[0x0114] = 0x00;
  m.ram[0x0106] = 0x80; // skip loop2
  m.ram[0x0125] = 0x01; // nonzero, positive -> beq & bmi both NOT taken
  m.ram[0x0003] = 0x07; // &7 == 7 -> cmp equal -> bne NOT taken -> lda #$01
  m.ram[0x0202] = 0x00; m.ram[0x0124] = 0x80; m.ram[0x0111] = 0x00;
  wireTables(m);

  loc_b367(m);

  assert.equal(m.ram[0x29], 0x01, "the $03-derived path writes 0x01 to $29");
});

test("loc_b367 MUTATION: a mischarged clear-loop STA (5T->4T) blows the golden T total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x9abb);
  m.ram[0x0114] = 0x00; m.ram[0x0106] = 0x80; m.ram[0x0125] = 0x00;
  m.ram[0x0202] = 0x00; m.ram[0x0124] = 0x80; m.ram[0x0111] = 0x00;
  wireTables(m);
  const realStep = m.step.bind(m);
  // undercharge every store that lands after b382 (the clear-loop sta) by 1T
  m.step = (n, c) => realStep(n, n === 0xb385 ? c - 1 : c);
  loc_b367(m);
  assert.notEqual(m.cycles, 1583, "a mischarged sta abs,x changes the T-state total");
});
