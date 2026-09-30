// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1a55 (wipeVideoAndHardwareLatches) -- equivalence vs the frozen translated oracle from its real dispatch
 * (captured during an oracle power-on boot) and from a crafted warm entry whose latches and RAM all sit away
 * from their boot values. The oracle runs on through the RAM tests and checksum to the main-loop hand-off, so
 * the whole downstream chain is compared. Teeth: broken twins of the wipe.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { captures, compare, warmEntry, romsPresent } from "./_coldBoot.js";
import { wipeVideoAndHardwareLatches as cand } from "../wipeVideoAndHardwareLatches.js";
import { marchTestWorkRam } from "../marchTestWorkRam.js";
import { loc_1a55 as oracle } from "../../translated/loc_1a55.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

test("EQUAL (captured dispatch): the wipe and the chain after it match the oracle", { skip }, () => {
  const entries = captures()[0x1a55];
  assert.equal(entries.length, 1, "positive control: the boot dispatches the wipe exactly once");
  assert.equal(compare(oracle, cand, entries[0]), null);
});

test("EQUAL (crafted warm entry)", { skip }, () => {
  assert.equal(compare(oracle, cand, warmEntry(captures()[0x0000][0])), null);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const entry = warmEntry(captures()[0x0000][0]);
  const lfoZero = (m) => { const r = cand(m); for (let i = 0; i < 4; i++) m.mem8[0x6004 + i] = 0; return r; };
  const pitchLow = (m) => { const r = cand(m); m.mem8[0x7800] = 0; return r; };
  const objramKept = (m) => { const keep = []; for (let i = 0; i < 256; i++) keep.push(m.mem8[0x5800 + i]);
    const r = cand(m); keep.forEach((v, i) => { m.mem8[0x5800 + i] = v; }); return r; };
  const noWipe = (m) => marchTestWorkRam(m, 32); // straight into the RAM test: screen, OBJRAM and latches left as found
  assert.ok(compare(oracle, lfoZero, entry), "LFO-zero twin escaped (io)");
  assert.ok(compare(oracle, pitchLow, entry), "pitch-low twin escaped (io)");
  assert.ok(compare(oracle, objramKept, entry), "OBJRAM-kept twin escaped (ram)");
  assert.ok(compare(oracle, noWipe, entry), "no-wipe twin escaped");
});
