// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for the loc_27ea unit (Frogger diver/turtle-dive driver, ROM 0x27EA-0x2855). Three
// exports: loc_27ea dispatches on the dive phase (0x83b7) and delegates into loc_27fe; loc_27fe walks
// the surface-timer pair (0x8146)/(0x8147); loc_281b copies a 2-byte anim frame from the ROM table (HL)
// to VRAM (DE=0xa806+(0x8145)) and resets the block once the frame index reaches 0x10. All callees stubbed.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_27ea, loc_27fe, loc_281b } from "../loc_27ea.js";

const bal = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; };
const STUBS = [0x2873, 0x2874, 0x288c, 0x27fe, 0x28b0, 0x286d, 0x281b];

function mk(rom = new Uint8Array(0x4000)) {
  const m = new Machine(rom, new Map(STUBS.map((a) => [a, bal])));
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];
const w = (m, a, val) => { m.mem.workRam[a - 0x8000] = val; };
const v = (m, i) => m.mem.videoRam[i];

test("loc_27ea: phase 3, (0x8101)==0 -> call z,0x288c then delegate loc_27fe", () => {
  const m = mk();
  w(m, 0x83b7, 0x03); w(m, 0x8101, 0x00);
  loc_27ea(m);
  assert.deepEqual(m.calls, [0x288c, 0x27fe], "the call then the fall-through delegate");
  assert.equal(m.regs.sp, 0x8800, "the call frame and delegate both unwound");
});

test("loc_27ea: phase 3, (0x8101)!=0 -> skips the call, delegates loc_27fe", () => {
  const m = mk();
  w(m, 0x83b7, 0x03); w(m, 0x8101, 0x07);
  loc_27ea(m);
  assert.deepEqual(m.calls, [0x27fe], "no call z, straight to the delegate");
});

test("loc_27ea: phase < 2 -> jp loc_2873; phase >= 5 -> jp loc_2874", () => {
  const m1 = mk(); w(m1, 0x83b7, 0x01); loc_27ea(m1);
  assert.deepEqual(m1.calls, [0x2873], "phase 1 tail-jumps loc_2873");
  const m2 = mk(); w(m2, 0x83b7, 0x05); loc_27ea(m2);
  assert.deepEqual(m2.calls, [0x2874], "phase 5 tail-jumps loc_2874");
});

test("loc_27fe: (0x814f)==0 -> ret z back to caller; 28 T", () => {
  const m = mk();
  w(m, 0x814f, 0x00);
  loc_27fe(m);
  assert.equal(m.pc, 0xbeef, "returned to the caller");
  assert.equal(m.cycles, 28, "ld a,(nn) 13 + and a 4 + ret z taken 11");
});

test("loc_27fe: (0x8146)!=(0x8147) -> jp loc_28b0", () => {
  const m = mk();
  w(m, 0x814f, 0x01); w(m, 0x8146, 0x05); w(m, 0x8147, 0x09);
  loc_27fe(m);
  assert.deepEqual(m.calls, [0x28b0], "unequal timer pair tail-jumps loc_28b0");
});

test("loc_27fe: equal pair, (0x8150) bit0==0 -> dec (0x8147), jp loc_286d", () => {
  const m = mk();
  w(m, 0x814f, 0x01); w(m, 0x8146, 0x04); w(m, 0x8147, 0x04); w(m, 0x8150, 0x00);
  loc_27fe(m);
  assert.equal(r(m, 0x8147), 0x03, "(0x8147) decremented");
  assert.deepEqual(m.calls, [0x286d], "bit0==0 tail-jumps loc_286d");
});

test("loc_27fe: equal pair, (0x8150) bit0==1 -> dec (0x8147), delegate loc_281b", () => {
  const m = mk();
  w(m, 0x814f, 0x01); w(m, 0x8146, 0x04); w(m, 0x8147, 0x04); w(m, 0x8150, 0x01);
  loc_27fe(m);
  assert.equal(r(m, 0x8147), 0x03, "(0x8147) decremented");
  assert.deepEqual(m.calls, [0x281b], "bit0==1 falls into loc_281b");
});

// loc_281b copy: table[HL] -> VRAM[0xa806 + (0x8145)], then (0x814e)+=2 / (0x8145)+=0x20.
function setCopy(m) {
  m.mem.rom[0x1413] = 0xaa; m.mem.rom[0x1414] = 0xbb;
  w(m, 0x814e, 0x00); w(m, 0x8145, 0x00);
  m.regs.hl = 0x1413; m.regs.de = 0xa806;
}
function checkCopy(m) {
  assert.equal(v(m, 0x006), 0xaa, "VRAM dest byte 0 = table[0]");
  assert.equal(v(m, 0x007), 0xbb, "VRAM dest byte 1 = table[1]");
  assert.equal(r(m, 0x814e), 0x02, "(0x814e) frame index += 2");
  assert.equal(r(m, 0x8145), 0x20, "(0x8145) column += 0x20");
}

test("loc_281b: copies one anim frame and advances the counters; ret c", () => {
  const m = mk();
  setCopy(m);
  loc_281b(m);
  checkCopy(m);
  assert.equal(m.pc, 0xbeef, "ret c (frame index 2 < 0x10)");
});

test("loc_281b: frame index reaching 0x10 copies then zeroes the block", () => {
  const m = mk();
  m.mem.rom[0x1421] = 0xcc; m.mem.rom[0x1422] = 0xdd; // 0x1413 + (0x814e)=0x0e
  w(m, 0x814e, 0x0e); w(m, 0x8145, 0x40);
  m.regs.hl = 0x1413; m.regs.de = 0xa806;
  loc_281b(m);
  assert.equal(v(m, 0x046), 0xcc, "copy still lands at 0xa806+0x40");
  assert.equal(v(m, 0x047), 0xdd, "second copy byte");
  for (const a of [0x814f, 0x814e, 0x8145, 0x8146, 0x8147]) {
    assert.equal(r(m, a), 0x00, `(0x${a.toString(16)}) reset to 0`);
  }
});

// MUTATION-PATCH  file: games/frogger/translated/loc_27ea.js
//   find: regs.c = 0x20;
//   repl: regs.c = 0x21;   // the per-frame VRAM column stride
//   expect: FAIL  ((0x8145) advances by 0x21, not 0x20 -- caught by checkCopy)
//   verified-anchor: count == 1  (the sole `regs.c = 0x20;` in loc_27ea.js)
// Simulated by intercepting the (0x8145) store 0x20 -> 0x21, which is what the edit produces.
test("loc_281b: the contract catches a wrong column stride", () => {
  const m = mk();
  setCopy(m);
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, val, o) => ow(a, a === 0x8145 && val === 0x20 ? 0x21 : val, o);
  loc_281b(m);
  assert.throws(() => checkCopy(m));
});
