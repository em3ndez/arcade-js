// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1a9a (marchTestWorkRam) -- equivalence vs the frozen translated oracle. The oracle re-enters 0x1a9a
 * once per seed (C = 32 down to 1), so a boot captures 32 real dispatches; every one is replayed. Crafted
 * warm entries poke C to 1, 5 and 0 (0 wraps to 256 seeds). Each replay runs on through the video-RAM test and
 * the checksum to the hand-off. A RAM fault (a cell that does not read back) must be raised by name.
 * Teeth: a seed-count twin (watchdog) and a count-up twin (the final pattern left above the seeded RAM).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { captures, compare, run, warmEntry, romsPresent } from "./_coldBoot.js";
import { marchTestWorkRam as cand, writeMarchPattern, verifyMarchPattern } from "../marchTestWorkRam.js";
import { marchTestVideoRam } from "../marchTestVideoRam.js";
import { loc_1a9a as oracle } from "../../translated/loc_1a9a.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

test("EQUAL (all captured dispatches)", { skip }, () => {
  const entries = captures()[0x1a9a];
  assert.equal(entries.length, 32, "positive control: one dispatch per seed");
  entries.forEach((e, i) => assert.equal(compare(oracle, cand, e), null, `dispatch ${i} (C=${e.regs.c})`));
});

test("EQUAL (crafted seed counts 1, 5, 0)", { skip }, () => {
  for (const c of [1, 5, 0]) {
    const e = warmEntry(captures()[0x0000][0], (m) => { m.regs.c = c; });
    assert.equal(compare(oracle, cand, e), null, `C=${c}`);
  }
});

test("RAM fault: a cell that does not read back is raised by name", { skip }, () => {
  const e = captures()[0x1a9a][0].clone();
  const write8 = e.mem.write8.bind(e.mem);
  e.mem.write8 = (a, v, ...rest) => write8(a, a === 0x4123 ? v ^ 0x10 : v, ...rest); // stuck bit 4 at one cell
  assert.throws(() => cand(e), /work RAM test: read-back mismatch at 4123/);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const e = warmEntry(captures()[0x0000][0], (m) => { m.regs.c = 5; });
  const fewer = (m) => cand(m, 4);
  const countUp = (m) => {
    for (let s = 1; s <= 5; s++) { writeMarchPattern(m, 0x4000, s); verifyMarchPattern(m, 0x4000, s, "w"); void m.mem8[0x7800]; }
    return marchTestVideoRam(m, 32);
  };
  assert.ok(compare(oracle, fewer, e), "4-seed twin escaped (watchdog)");
  assert.ok(compare(oracle, countUp, e), "count-up twin escaped (ram above the seeded span)");
  assert.equal(run(countUp, e).handedOff, true, "the count-up twin differs only in the pattern it leaves");
});
