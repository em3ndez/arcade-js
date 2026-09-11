// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9d06 (ROM 0x9d06-0x9d66). Covers: toggle-and-rts (9d22), beq-to-9d23 +
// jsr $9d67 path, inc-and-rts (9d2b), scan MATCH (9d54), scan EXHAUSTION (bmi -> 9d54 with y=0xff),
// and an abs,x page-cross edge. Run: node --test games/tempest/translated/test/equivalence-9d06.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9d06 } from "../loc_9d06.js";

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

test("(&7)==1 & $03ab!=0: toggle bit7 of $028a,x then rts (9d22)", () => {
  const m = makeMachine(); m.push16(0x1234);
  m.regs.x = 0x00;
  m.mem.write8(0x0202, 0x33);
  m.mem.write8(0x0283, 0x01);   // &7==1, bit7 clear
  m.mem.write8(0x03ab, 0x09);   // nonzero -> beq not taken
  m.mem.write8(0x028a, 0x00);
  loc_9d06(m);
  assert.deepEqual(m.calls, [], "no call");
  assert.equal(m.mem.read8(0x02df), 0x33, "sta $0202 into $02df,x");
  assert.equal(m.mem.read8(0x028a), 0x80, "bit7 toggled");
  assert.equal(m.pc, 0x1235, "rts -> pushed + 1");
  assert.equal(m.cycles, 4 + 5 + 4 + 2 + 2 + 2 + 4 + 2 + 4 + 2 + 5 + 6, "= 42");
});

test("edge: abs,x page cross adds +1 on $0283,x and $028a,x loads", () => {
  const m = makeMachine(); m.push16(0x1234);
  m.regs.x = 0x80;              // 0x0283+0x80=0x0303, 0x028a+0x80=0x030a -> both cross
  m.mem.write8(0x0202, 0x33);
  m.mem.write8(0x0303, 0x81);   // &7==1, bit7 set (irrelevant here)
  m.mem.write8(0x03ab, 0x09);
  m.mem.write8(0x030a, 0x00);
  loc_9d06(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.mem.read8(0x030a), 0x80, "toggled at crossed addr");
  assert.equal(m.mem.read8(0x035f), 0x33, "sta into $02df,x (0x035f)");
  assert.equal(m.pc, 0x1235);
  // vs the in-page 42: two loads cross (+1 each)
  assert.equal(m.cycles, 4 + 5 + 5 + 2 + 2 + 2 + 4 + 2 + 5 + 2 + 5 + 6, "= 44");
});

test("beq->9d23, negative slot: inc $02df,x then rts (9d2b)", () => {
  const m = makeMachine(); m.push16(0x1234);
  m.regs.x = 0x00;
  m.mem.write8(0x0202, 0x10);
  m.mem.write8(0x0283, 0x82);   // &7==2 (!=1) -> bne taken to 9d23; bit7 set -> bpl NOT taken
  loc_9d06(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.mem.read8(0x02df), 0x11, "0x10 stored then inc -> 0x11");
  assert.equal(m.pc, 0x1235, "rts");
  assert.equal(m.cycles, 4 + 5 + 4 + 2 + 2 + 3 + 4 + 2 + 7 + 6, "= 39");
});

test("$0109!=1: jsr $9d67 then tail (9d5e)", () => {
  const m = makeMachine(); m.push16(0x1234);
  m.regs.x = 0x00;
  m.mem.write8(0x0202, 0x10);
  m.mem.write8(0x0283, 0x01);   // (&7)==1 ...
  m.mem.write8(0x03ab, 0x00);   // ... but $03ab==0 -> beq to 9d23
  m.mem.write8(0x0108, 0x05);
  m.mem.write8(0x0109, 0x03);   // !=1 -> beq not taken -> jsr path
  loc_9d06(m);
  assert.deepEqual(m.calls, [0x9d67], "jsr $9d67");
  assert.equal(m.mem.read8(0x0108), 0x04, "dec $0108");
  assert.equal(m.mem.read8(0x010b), 0x41, "$010b = 0x41");
  assert.equal(m.mem.read8(0x0109), 0x04, "inc $0109");
  assert.equal(m.cycles,
    4 + 5 + 4 + 2 + 2 + 2 + 4 + 3 + 4 + 3 + 6 + 4 + 2 + 2 + 6 + 2 + 3 + 2 + 4 + 6 + 6, "= 76");
});

test("scan MATCH: copies (($0283,y & 0x40)^0x40) into $0283,x (9d54)", () => {
  const m = makeMachine(); m.push16(0x1234);
  m.regs.x = 0x00;
  m.mem.write8(0x0202, 0x55);
  m.mem.write8(0x0283, 0x00);   // &7==0 -> bne taken to 9d23; bit7 clear -> bpl taken to 9d2c
  m.mem.write8(0x0108, 0x08);
  m.mem.write8(0x0109, 0x01);   // ==1 -> beq to 9d3c scan
  // slots 6,5,4 empty; slot 3 matches $0202 (0x55); slot 0 is self (skipped by cpx)
  m.mem.write8(0x02e2, 0x55);   // $02df+3
  m.mem.write8(0x0286, 0x00);   // $0283+3 -> &0x40=0, ^0x40=0x40
  loc_9d06(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.y, 0x03, "matched at y=3");
  assert.equal(m.mem.read8(0x0283), 0x40, "((0x00 & 0x40) ^ 0x40) = 0x40 written into $0283,x");
  assert.equal(m.regs.a, 0x41, "A reloaded by tail lda #0x41");
  assert.equal(m.mem.read8(0x0109), 0x02, "inc $0109");
  assert.equal(m.mem.read8(0x010b), 0x41);
  assert.equal(m.pc, 0x1235, "rts");
  assert.equal(m.cycles,
    4 + 5 + 4 + 2 + 2 + 3 + 4 + 3 + 6 + 4 + 2 + 3 + 2   // through 9d3c ldy -> 44
    + (4 + 3 + 2 + 3) * 3                               // y=6,5,4 empty skips
    + 4 + 2 + 3 + 3 + 2 + 4 + 4 + 3                     // y=3 match
    + 4 + 2 + 2 + 5                                     // 9d54 store
    + 2 + 4 + 6 + 6, "= 136");                          // tail
});

test("scan EXHAUSTION: no match, dey wraps -> bmi to 9d54 with y=0xff", () => {
  const m = makeMachine(); m.push16(0x1234);
  m.regs.x = 0x00;
  m.mem.write8(0x0202, 0x55);   // slot 0 (self) becomes 0x55, skipped via cpx
  m.mem.write8(0x0283, 0x00);
  m.mem.write8(0x0108, 0x08);
  m.mem.write8(0x0109, 0x01);
  // slots 1..6 all empty; 0x0382 = $0283 + 0xff (page cross)
  m.mem.write8(0x0382, 0x00);   // -> &0x40=0, ^0x40=0x40
  loc_9d06(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.y, 0xff, "y wrapped to 0xff");
  assert.equal(m.mem.read8(0x0283), 0x40, "written into $0283,x");
  assert.equal(m.regs.a, 0x41, "A reloaded by tail lda #0x41");
  assert.equal(m.mem.read8(0x0109), 0x02);
  assert.equal(m.pc, 0x1235, "rts");
  assert.equal(m.cycles,
    4 + 5 + 4 + 2 + 2 + 3 + 4 + 3 + 6 + 4 + 2 + 3 + 2   // through 9d3c ldy -> 44
    + (4 + 3 + 2 + 3) * 6                               // y=6..1 empty skips
    + 4 + 2 + 3 + 3 + 3 + 2 + 2                         // y=0 self skip -> dey -> bmi
    + 5 + 2 + 2 + 5                                     // 9d54 (lda crosses) store
    + 2 + 4 + 6 + 6, "= 167");                          // tail
});
