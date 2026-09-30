// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1aca (marchTestVideoRam) -- equivalence vs the frozen translated oracle. The oracle re-enters 0x1aca once
 * per seed (C = 32 down to 1): all 32 captured dispatches are replayed, plus crafted warm entries with C = 1, 3
 * and 0 (256 seeds). The checksum stage that follows blanks the tilemap, so the test's own pattern is not in the
 * end state; the watchdog count and the downstream seeding are. A video-RAM fault must be raised by name.
 * Teeth: a missing mid-pass kick, and a twin that skips the checksum stage.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { captures, compare, warmEntry, romsPresent } from "./_coldBoot.js";
import { marchTestVideoRam as cand } from "../marchTestVideoRam.js";
import { writeMarchPattern, verifyMarchPattern } from "../marchTestWorkRam.js";
import { checksumRomAndSeedWorkRam } from "../checksumRomAndSeedWorkRam.js";
import { enterMainLoop } from "../enterMainLoop.js";
import { loc_1aca as oracle } from "../../translated/loc_1aca.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

test("EQUAL (all captured dispatches)", { skip }, () => {
  const entries = captures()[0x1aca];
  assert.equal(entries.length, 32, "positive control: one dispatch per seed");
  entries.forEach((e, i) => assert.equal(compare(oracle, cand, e), null, `dispatch ${i} (C=${e.regs.c})`));
});

test("EQUAL (crafted seed counts 1, 3, 0)", { skip }, () => {
  for (const c of [1, 3, 0]) {
    const e = warmEntry(captures()[0x0000][0], (m) => { m.regs.c = c; });
    assert.equal(compare(oracle, cand, e), null, `C=${c}`);
  }
});

test("RAM fault: a video-RAM cell that does not read back is raised by name", { skip }, () => {
  const e = captures()[0x1aca][0].clone();
  const write8 = e.mem.write8.bind(e.mem);
  e.mem.write8 = (a, v, ...rest) => write8(a, a === 0x5200 ? v ^ 0x01 : v, ...rest);
  assert.throws(() => cand(e), /video RAM test: read-back mismatch at 5200/);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const e = warmEntry(captures()[0x0000][0], (m) => { m.regs.c = 3; });
  const oneKick = (m) => {
    for (let s = 3; s >= 1; s--) { writeMarchPattern(m, 0x5000, s); verifyMarchPattern(m, 0x5000, s, "v"); void m.mem8[0x7800]; }
    return checksumRomAndSeedWorkRam(m);
  };
  const skipStage = (m) => {
    for (let s = 3; s >= 1; s--) { writeMarchPattern(m, 0x5000, s); void m.mem8[0x7800]; verifyMarchPattern(m, 0x5000, s, "v"); void m.mem8[0x7800]; }
    return enterMainLoop(m);
  };
  assert.ok(compare(oracle, oneKick, e), "one-kick twin escaped (watchdog)");
  assert.ok(compare(oracle, skipStage, e), "skip-checksum twin escaped (ram/io)");
});
