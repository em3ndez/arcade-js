// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1b70 (checksumRomAndSeedWorkRam) -- equivalence vs the frozen translated oracle from its one captured
 * dispatch and a crafted warm entry (RAM populated, latches away from their boot values), both running to the
 * main-loop hand-off. A bad program ROM (one flipped byte) must be raised by name. Teeth: broken twins of the
 * seeding (queue ring left 0, wrong self-test mode, starfield left off) and of the hand-off.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { captures, compare, warmEntry, romsPresent } from "./_coldBoot.js";
import { checksumRomAndSeedWorkRam as cand } from "../checksumRomAndSeedWorkRam.js";
import { loc_1b70 as oracle } from "../../translated/loc_1b70.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

test("EQUAL (captured dispatch)", { skip }, () => {
  const entries = captures()[0x1b70];
  assert.equal(entries.length, 1, "positive control: the boot reaches the checksum stage once");
  assert.equal(compare(oracle, cand, entries[0]), null);
});

test("EQUAL (crafted warm entry)", { skip }, () => {
  assert.equal(compare(oracle, cand, warmEntry(captures()[0x0000][0])), null);
});

test("bad ROM: a non-zero checksum is raised by name", { skip }, () => {
  const e = captures()[0x1b70][0].clone();
  e.mem.rom[0x0123] ^= 0x01;
  assert.throws(() => cand(e), /program ROM checksum is \d+, not 0/);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const e = warmEntry(captures()[0x0000][0]);
  const after = (poke) => (m) => { const r = cand(m); poke(m); return r; };
  const ringZero = after((m) => { for (let i = 0; i < 0x40; i++) m.mem8[0x40c0 + i] = 0; });
  const modeOne = after((m) => { m.mem8[0x401a] = 1; });
  const starsOff = after((m) => { m.mem8[0x7004] = 0; });
  const noHandoff = (m) => { cand(m); };
  assert.ok(compare(oracle, ringZero, e), "ring-zero twin escaped (ram)");
  assert.ok(compare(oracle, modeOne, e), "self-test-mode twin escaped (ram)");
  assert.ok(compare(oracle, starsOff, e), "stars-off twin escaped (io)");
  assert.ok(compare(oracle, noHandoff, e), "no-hand-off twin escaped");
});
