// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0020 — equivalent to the frozen oracle at ROM 0x0020 (the RST 20 indexed-fetch vector).
 * LIVE-OUT is registers only: HL <- base + index (16-bit carry) and A <- the fetched byte. It writes
 * no RAM, so ramDiff would be VACUOUS -- equivalence is asserted on regs A and HL via regsAfter, with a
 * wrong-register comparator for teeth. Positive control: the oracle really advanced HL and read the byte.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, romsPresent, STUBS } from "./_bootSetup.js";
import { loc_0020 as cand } from "../loc_0020.js";
import { loc_0020 as oracle } from "../../translated/loc_0020.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const TABLE = 0x4380;      // clean work RAM below the masked stack window
const INDEX = 5;           // register A on entry
const ENTRY_VAL = 0x42;    // planted at TABLE+INDEX (differs from INDEX so a no-op twin diverges)

const seed = () => craft((mem8, m) => {
  m.regs.a = INDEX;
  m.regs.hl = TABLE;
  mem8[TABLE + INDEX] = ENTRY_VAL;
  m.push16(0x9999); // ret target for the oracle's `ret`
});

function regsAfter(fn, entry) {
  const m = entry.clone(); m.routines = STUBS; fn(m);
  return { a: m.regs.a, hl: m.regs.hl };
}
const diverges = (twin, e) => {
  const t = regsAfter(twin, e), o = regsAfter(oracle, e);
  return t.a !== o.a || t.hl !== o.hl;
};

test("EQUAL (crafted): loc_0020 == oracle fetches the byte and advances HL", { skip }, () => {
  const e = seed();
  const c = regsAfter(cand, e), o = regsAfter(oracle, e);
  assert.equal(c.a, o.a, "fetched byte (A) diverged");
  assert.equal(c.hl, o.hl, "advanced pointer (HL) diverged");

  const a = seed(); oracle(a);
  assert.equal(a.regs.a, ENTRY_VAL, "positive control: oracle fetched the table byte");
  assert.equal(a.regs.hl, TABLE + INDEX, "positive control: oracle advanced HL to base+index");
  console.log(`  EQUAL: A=0x${a.regs.a.toString(16)}, HL=0x${a.regs.hl.toString(16)}`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const e = seed();
  const noOp = () => {};                                                   // A=index, HL=base
  const offByOne = (m) => { const h = (m.regs.hl + m.regs.a) & 0xffff; m.regs.hl = h; m.regs.a = (m.mem8[h] + 1) & 0xff; };
  const noAdvance = (m) => { m.regs.a = m.mem8[(m.regs.hl + m.regs.a) & 0xffff]; }; // A right, HL never moved
  assert.ok(diverges(noOp, e), "the no-op twin escaped");
  assert.ok(diverges(offByOne, e), "the off-by-one-byte twin escaped");
  assert.ok(diverges(noAdvance, e), "the HL-not-advanced twin escaped");
  console.log("  TEETH: no-op, off-by-one byte, HL-not-advanced all caught (regs)");
});
