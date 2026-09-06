// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_21f8 — crafted-entry equivalence vs the frozen number-field draw entry at ROM 0x21f8.
 * It seats a fixed VRAM cursor and delegates the six-digit packed-BCD paint; the source pointer is the
 * caller's DE. Memory-only live-out: the six VRAM tile cells at the fixed cursor stepping one row up per
 * digit (0x5241, 0x5221, ... 0x51a1). No register/io live-out the caller reads.
 * Teeth: a no-op twin, perturbations of the top and bottom drawn cells, and a wrong-source twin that
 * exercises the DE-source threading.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { loc_21f8 as cand } from "../loc_21f8.js";
import { loc_21f8 as oracle } from "../../translated/loc_21f8.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const SOURCE = 0x4302;    // high byte of a 3-byte packed-BCD number (walked downward)
const ALT_SOURCE = 0x4300;
const TOP_CELL = 0x5241;  // first digit painted
const BOTTOM_CELL = 0x51a1; // sixth digit (cursor stepped up 5 rows of 32)
const CELLS = [0x5241, 0x5221, 0x5201, 0x51e1, 0x51c1, 0x51a1];

// DE points at a 3-byte BCD number; the six destination tiles are dirtied so the paint is observable.
const entry = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mm.regs.de = SOURCE;
  mem[0x4300] = 0x12;
  mem[0x4301] = 0x34;
  mem[0x4302] = 0x56;
  for (const c of CELLS) mem[c] = 0xff;
});

function runOracle(e) { const a = e.clone(); a.routines = STUBS; oracle(a); return a; }

test("EQUAL (crafted): loc_21f8 == oracle paints the number field", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, entry()), null, "loc_21f8 diverged on the number-field paint");
  const a = runOracle(entry());
  assert.notEqual(a.mem8[TOP_CELL], 0xff, "positive control: oracle painted the top digit cell");
  assert.notEqual(a.mem8[BOTTOM_CELL], 0xff, "positive control: oracle painted the bottom digit cell");
  console.log("  EQUAL: loc_21f8 == oracle, six digit tiles painted at the fixed cursor");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongTop = (m) => { cand(m); m.mem8[TOP_CELL] = m.mem8[TOP_CELL] ^ 0xff; };
  const wrongBottom = (m) => { cand(m); m.mem8[BOTTOM_CELL] = m.mem8[BOTTOM_CELL] ^ 0xff; };
  const wrongSource = (m) => { cand(m, ALT_SOURCE); }; // draws a different number -> different tiles
  assert.ok(ramDiff(oracle, noOp, entry()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongTop, entry()), "perturbed-top twin escaped");
  assert.ok(ramDiff(oracle, wrongBottom, entry()), "perturbed-bottom twin escaped");
  assert.ok(ramDiff(oracle, wrongSource, entry()), "wrong-source twin escaped");
  console.log("  TEETH: no-op, perturbed-top, perturbed-bottom, wrong-source all caught");
});
