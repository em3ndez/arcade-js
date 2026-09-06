// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_18c0 — crafted-entry equivalence vs the frozen message-scroller step at ROM 0x18c0.
 * Gated by MESSAGE_SCROLL_ENABLE (0x40b0) bit0. Three live paths, all landing in work RAM / VRAM
 * (so ramDiff carries the verdict): DELAY (counter low bits set -> tick only), TERMINATOR (source
 * char 63 -> tick only), EMIT (advance source, char->tile into the dest cell, step dest up a column,
 * tick). Plus the idle path (disabled -> untouched). Teeth: no-op, an enable-ignoring twin, and a
 * scribble on the drawn glyph cell proving ramDiff still bites.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent } from "./_bootSetup.js";
import { advanceMessageScroller as cand } from "../advanceMessageScroller.js";
import { loc_18c0 as oracle } from "../../translated/loc_18c0.js";

const ENABLE = 0x40b0;
const CURSOR = 0x40b1; // -> counter byte
const TEXT = 0x40b3;   // -> source char
const DEST = 0x40b5;   // -> VRAM cell
const COUNTER = 0x40c0;
const SRC = 0x40c2;
const VRAM = 0x5100;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const delayEntry = () => craft((mem, mm) => {
  mem[ENABLE] = 1; mm.mem16[CURSOR] = COUNTER; mem[COUNTER] = 5; mm.push16(0x9999);
});
const terminatorEntry = () => craft((mem, mm) => {
  mem[ENABLE] = 1; mm.mem16[CURSOR] = COUNTER; mem[COUNTER] = 8;
  mm.mem16[TEXT] = SRC; mem[SRC] = 63; mm.push16(0x9999);
});
const emitEntry = () => craft((mem, mm) => {
  mem[ENABLE] = 1; mm.mem16[CURSOR] = COUNTER; mem[COUNTER] = 8;
  mm.mem16[TEXT] = SRC; mem[SRC] = 65; mm.mem16[DEST] = VRAM; mem[VRAM] = 0; mm.push16(0x9999);
});
const idleEntry = () => craft((mem, mm) => { mem[ENABLE] = 0; mem[COUNTER] = 8; mm.push16(0x9999); });

test("EQUAL (crafted): loc_18c0 == oracle ticks the delay counter", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, delayEntry()), null, "loc_18c0 diverged on the delay path");
  const a = delayEntry(); oracle(a);
  assert.equal(a.mem8[COUNTER], 4, "positive control: delay path did not tick the counter");
});

test("EQUAL (crafted): loc_18c0 == oracle ticks-only at a terminator", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, terminatorEntry()), null, "loc_18c0 diverged on the terminator path");
  const a = terminatorEntry(); oracle(a);
  assert.equal(a.mem8[COUNTER], 7, "positive control: terminator did not tick the counter");
  assert.equal(a.mem16[TEXT], SRC, "positive control: terminator advanced the source");
});

test("EQUAL (crafted): loc_18c0 == oracle emits one glyph", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, emitEntry()), null, "loc_18c0 diverged on the emit path");
  const a = emitEntry(); oracle(a);
  assert.equal(a.mem8[VRAM], 65 - 48, "positive control: emit wrote the wrong tile");
  assert.equal(a.mem16[TEXT], SRC + 1, "positive control: emit did not advance the source");
  assert.equal(a.mem16[DEST], VRAM - 32, "positive control: emit did not step the dest up a column");
  assert.equal(a.mem8[COUNTER], 7, "positive control: emit did not tick the counter");
});

test("EQUAL (crafted): loc_18c0 == oracle bails when disabled", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, idleEntry()), null, "loc_18c0 diverged on the idle path");
  const a = idleEntry(); oracle(a);
  assert.equal(a.mem8[COUNTER], 8, "positive control: disabled -> counter untouched");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const ignoreEnable = (m) => { m.mem8[COUNTER] = (m.mem8[COUNTER] - 1) & 0xff; }; // ticks while disabled
  const scribble = (m) => { cand(m); m.mem8[VRAM] ^= 0xff; };                       // wrong drawn glyph
  assert.ok(ramDiff(oracle, noOp, emitEntry()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, ignoreEnable, idleEntry()), "enable-ignoring twin escaped");
  assert.ok(ramDiff(oracle, scribble, emitEntry()), "glyph scribble escaped (ramDiff teeth)");
});
