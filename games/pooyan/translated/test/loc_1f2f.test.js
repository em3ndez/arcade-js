// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_1f2f (ROM 0x1f2f, Pooyan) -- the level-tag / stage-label HUD
 * updater. Gated on (0x8d56)==0. Stage index (0x8901) maps to a column code C: <0x0a passes through
 * (and latches 0x8d56); else it is looked up in the 5-entry table at 0x1f87. When C==0 it renders a
 * BCD round counter (loc_1f8c, glyph table 0x1fda/0x1fe6 per DAA bit4) and clears a HUD cell (rst
 * 0x10); it always draws the fixed label via loc_0c45 + a second loc_1f8c pass.
 *
 * The mock's `call`/rst modelling POPS the pushed return address, so a missing push16 desyncs SP and
 * the final ret pops garbage -- the stack tooth (asserted via pcSeq tail + SP baseline).
 *
 * Run: node --test games/pooyan/translated/test/loc_1f2f.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1f2f } from "../loc_1f2f.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1f2f, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) {
      regs.sp = (regs.sp - 2) & 0xffff;
      mem.write8(regs.sp, v & 0xff);
      mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
    },
    pop16() {
      const lo = mem.read8(regs.sp);
      const hi = mem.read8((regs.sp + 1) & 0xffff);
      regs.sp = (regs.sp + 2) & 0xffff;
      return lo | (hi << 8);
    },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

// Path FIRST-STAGE: index 0 (< 0x0a) -> latch 0x8d56, C=0 -> full round render (round=0x8907+1=1,
// bit4 clear -> DE=0x1fda), rst 0x10 clear, then the fixed label draw.
function setupFirst(m) {
  seatCaller(m);
  m.mem.write8(0x8d56, 0x00); // gate open
  m.mem.write8(0x8901, 0x00); // stage index 0 -> jr c (< 0x0a)
  m.mem.write8(0x8907, 0x00); // round base 0 -> B=1, count once -> A=1
}

const PC_FIRST = [
  0x1f32, 0x1f33, 0x1f34, 0x1f35, 0x1f38, 0x1f3a, 0x1f49, 0x1f4b, 0x1f4e, 0x1f4f, 0x1f50,
  0x1f52, 0x1f55, 0x1f57, 0x1f58, 0x1f59, 0x1f5b, 0x1f5c, 0x1f5e, 0x1f61, 0x1f63, 0x1f65,
  0x1f68, 0x1f6b, 0x1f8c, 0x1f70, 0x1f72, 0x0010, 0x1f76, 0x1f79, 0x1f7a, 0x1f7d, 0x0c45,
  0x1f83, 0x1f8c, CALLER_RET,
];

test("loc_1f2f Path FIRST-STAGE: index<0x0a, C=0 -> round render + label", () => {
  const m = makeMachine();
  setupFirst(m);

  loc_1f2f(m);

  assert.equal(m.tstates, 321, "Path FIRST-STAGE T-state total");
  assert.deepEqual(m.pcSeq, PC_FIRST, "step boundaries match the ROM bytes");
  assert.deepEqual(m.calls, [0x1f8c, 0x0010, 0x0c45, 0x1f8c], "loc_1f8c, rst 0x10, loc_0c45, loc_1f8c");
  assert.equal(m.mem.read8(0x8d56), 0x01, "gate latched so this runs once");
  assert.equal(m.mem.read8(0x8743), 0x00, "stage index stashed at 0x8743");
  assert.equal(m.regs.de, 0x1fda, "glyph table 0x1fda (round=1, bit4 clear)");
  assert.equal(m.pc, CALLER_RET, "ret to seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound (every push16 matched a callee ret)");
});

test("loc_1f2f Path GATE: 0x8d56 non-zero -> ret nz immediately", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d56, 0x01);

  loc_1f2f(m);

  assert.equal(m.tstates, 13 + 4 + 11, "ld a + and a + ret nz");
  assert.deepEqual(m.pcSeq, [0x1f32, 0x1f33, CALLER_RET]);
  assert.deepEqual(m.calls, []);
});

test("loc_1f2f Path NOMATCH: index>=0x0a not in table -> djnz loop exhausts, ret at 0x1f48", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d56, 0x00);
  m.mem.write8(0x8901, 0x0a); // == 0x0a -> jr c not taken; table (09 14 1e 28 30) has no 0x0a
  // table bytes live in ROM at 0x1f87..0x1f8b; the mock RAM starts zeroed, so seed them to match ROM
  m.mem.write8(0x1f87, 0x09);
  m.mem.write8(0x1f88, 0x14);
  m.mem.write8(0x1f89, 0x1e);
  m.mem.write8(0x1f8a, 0x28);
  m.mem.write8(0x1f8b, 0x30);

  loc_1f2f(m);

  assert.equal(m.tstates, 260, "Path NOMATCH T-state total");
  assert.deepEqual(m.pcSeq, [
    0x1f32, 0x1f33, 0x1f34, 0x1f35, 0x1f38, 0x1f3a, 0x1f3c, 0x1f3f, 0x1f41,
    0x1f42, 0x1f44, 0x1f45, 0x1f46, 0x1f41,
    0x1f42, 0x1f44, 0x1f45, 0x1f46, 0x1f41,
    0x1f42, 0x1f44, 0x1f45, 0x1f46, 0x1f41,
    0x1f42, 0x1f44, 0x1f45, 0x1f46, 0x1f41,
    0x1f42, 0x1f44, 0x1f45, 0x1f46, 0x1f48,
    CALLER_RET,
  ], "5 loop iterations then ret at 0x1f48");
  assert.deepEqual(m.calls, [], "no render on the no-match branch");
  assert.equal(m.mem.read8(0x8d56), 0x00, "gate NOT latched on the no-match branch");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
});

test("loc_1f2f Path LATER-STAGE: index<0x0a but C from a table match !=0 -> skip round render", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d56, 0x00);
  m.mem.write8(0x8901, 0x14); // >= 0x0a; matches table[1]=0x14 -> C=1 (non-zero)
  m.mem.write8(0x1f87, 0x09);
  m.mem.write8(0x1f88, 0x14);

  loc_1f2f(m);

  // scan: cp 0x09 (no), inc c->1, cp 0x14 (match) -> jr z to 0x1f4e; ld a,c (=1); and a NZ -> jr nz 0x1f7a
  assert.deepEqual(m.pcSeq, [
    0x1f32, 0x1f33, 0x1f34, 0x1f35, 0x1f38, 0x1f3a, 0x1f3c, 0x1f3f, 0x1f41,
    0x1f42, 0x1f44, 0x1f45, 0x1f46, 0x1f41, // iter1 no match
    0x1f42, 0x1f4e,                         // iter2 match -> jr z
    0x1f4f, 0x1f50, 0x1f7a, 0x1f7d, 0x0c45, 0x1f83, 0x1f8c, CALLER_RET,
  ], "matched non-zero C skips the round render, still draws the label");
  assert.deepEqual(m.calls, [0x0c45, 0x1f8c], "only the fixed-label pair");
  assert.equal(m.mem.read8(0x8d56), 0x00, "no latch on the table-match branch");
});

test("loc_1f2f MUTATION: `call 0x0c45` mis-charged 16T (not 17T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x0c45 ? 16 : cycles);
  setupFirst(m);

  loc_1f2f(m);

  assert.equal(m.tstates, 320, "mutation loses 1 T");
  assert.throws(
    () => assert.equal(m.tstates, 321, "Path FIRST-STAGE T-state total"),
    /321/,
    "the 321-T golden must fail on the mutant",
  );
});
