// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0010 — crafted-entry equivalence vs the frozen memory-fill vector at ROM 0x0010.
 * The routine writes `count` bytes of `value` from `dest` (RAM live-out, in the state dump) and hands
 * back two registers the still-translated layer may read: HL advanced past the fill, and B spent to 0.
 * So EQUAL asserts ramDiff==null (the fill, stack window masked) AND register HL/B via regDiff; a
 * memory-only check would miss the register live-outs. Teeth: no-op and wrong-value (RAM), an over-fill
 * of the byte past the run (RAM boundary), and HL/B register twins.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { loc_0010 as cand } from "../loc_0010.js";
import { loc_0010 as oracle } from "../../translated/loc_0010.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const DEST = 0x4100; // a work-RAM scratch span, clear of the masked stack window
const VALUE = 0xab;
const COUNT = 5;
const END = DEST + COUNT; // pointer past the fill

// Seed the fill inputs (HL/A/B) plus a return word for the oracle's ret.
const entry = () => craft((mem, mm) => {
  mm.regs.hl = DEST;
  mm.regs.a = VALUE;
  mm.regs.b = COUNT;
  mm.push16(0x9999);
});

// null == equivalent: RAM identical (stack masked) AND register HL and B match.
function regDiff(twin, e) {
  const ram = ramDiff(oracle, twin, e);
  if (ram) return `RAM ${ram}`;
  const a = e.clone(); a.routines = STUBS; oracle(a);
  const b = e.clone(); b.routines = STUBS; twin(b);
  if (a.regs.hl !== b.regs.hl) return `HL: ${a.regs.hl} vs ${b.regs.hl}`;
  if (a.regs.b !== b.regs.b) return `B: ${a.regs.b} vs ${b.regs.b}`;
  return null;
}

test("EQUAL (crafted): loc_0010 fills the run and advances HL/B like the oracle", { skip }, () => {
  assert.equal(regDiff(cand, entry()), null, "the fill or its register live-outs diverged");
  // non-vacuous: the oracle really fills the span and hands back the advanced pointer + spent count.
  const a = entry().clone(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[DEST], VALUE, "positive control: oracle filled the first byte");
  assert.equal(a.mem8[END - 1], VALUE, "positive control: oracle filled the last byte");
  assert.equal(a.regs.hl, END, "positive control: oracle advanced HL past the fill");
  assert.equal(a.regs.b, 0, "positive control: oracle spent B to 0");
  console.log(`  EQUAL: loc_0010 filled ${COUNT} bytes, HL->0x${END.toString(16)}, B->0`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongValue = (m) => { for (let i = 0; i < COUNT; i++) m.mem8[DEST + i] = VALUE ^ 0xff; };
  const overFill = (m) => { cand(m); m.mem8[END] = m.mem8[END] ^ 0xff; };       // wrote one byte too many
  const wrongHl = (m) => { cand(m); m.regs.hl = 0; };                           // right RAM, wrong HL
  const wrongB = (m) => { cand(m); m.regs.b = COUNT; };                         // right RAM, wrong B
  assert.ok(regDiff(noOp, entry()), "no-op twin escaped");
  assert.ok(regDiff(wrongValue, entry()), "wrong-value twin escaped");
  assert.ok(regDiff(overFill, entry()), "over-fill twin escaped (boundary)");
  assert.ok(regDiff(wrongHl, entry()), "wrong-HL twin escaped (register)");
  assert.ok(regDiff(wrongB, entry()), "wrong-B twin escaped (register)");
  console.log("  TEETH: no-op, wrong-value, over-fill (RAM) + HL/B (register) all caught");
});
