// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2256 — equivalent to the frozen oracle. Picks the VRAM digit-field cursor from a selector (the
 * primary field 0x5381 when zero, the alternate field 0x5121 otherwise) and paints the packed-BCD column
 * into it. The live-outs are the six digit-tile writes (VIDEORAM, in the state dump) -> ramDiff; two
 * selector values exercise both fields. IX is an internal render cursor, dead after, so a memory-only diff
 * is complete. Teeth: a no-op and a wrong-field twin (renders to the other field). Stack window masked.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent } from "./_bootSetup.js";
import { drawScoreToSelectedPlayerField as cand } from "../drawScoreToSelectedPlayerField.js";
import { loc_2256 as oracle } from "../../translated/loc_2256.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const PRIMARY = 0x5381, ALT = 0x5121;
const SOURCE = 0x4140; // three packed-BCD bytes, read downward

function seedNumber(mem) {
  mem[SOURCE] = 0x12; mem[SOURCE - 1] = 0x34; mem[SOURCE - 2] = 0x56;
}
function seedField(mem, base) {
  for (let i = 0; i < 6; i++) mem[(base - i * 0x20) & 0xffff] = 0xee; // sentinels in the six target cells
}
const primaryEntry = () => craft((mem, m) => {
  m.push16(0x9999); m.regs.a = 0; m.regs.de = SOURCE; seedNumber(mem); seedField(mem, PRIMARY);
});
const altEntry = () => craft((mem, m) => {
  m.push16(0x9999); m.regs.a = 1; m.regs.de = SOURCE; seedNumber(mem); seedField(mem, ALT);
});

test("EQUAL (crafted): loc_2256 == oracle paints the primary field when the selector is 0", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, primaryEntry()), null, "loc_2256 diverged on the primary field");
  const a = primaryEntry(); oracle(a);
  assert.notEqual(a.mem8[PRIMARY], 0xee, "positive control: the primary field was painted");
  console.log("  EQUAL: loc_2256 == oracle (RAM), selector 0 -> primary field");
});

test("EQUAL (crafted): loc_2256 == oracle paints the alternate field when the selector is nonzero", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, altEntry()), null, "loc_2256 diverged on the alternate field");
  const a = altEntry(); oracle(a);
  assert.notEqual(a.mem8[ALT], 0xee, "positive control: the alternate field was painted");
  console.log("  EQUAL: loc_2256 == oracle (RAM), selector !=0 -> alternate field");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  // wrong-field twin: forces the selector nonzero, so it renders to the alternate field for a primary entry.
  const wrongField = (m) => { m.regs.a = 1; cand(m); };
  assert.ok(ramDiff(oracle, noOp, primaryEntry()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongField, primaryEntry()), "the wrong-field twin escaped");
  console.log("  TEETH: no-op, wrong-field all caught");
});
