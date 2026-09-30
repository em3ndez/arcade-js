// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0000 (coldBoot) -- equivalence vs the frozen translated oracle for the whole cold-boot chain it starts.
 * Entry 1 is the real one: a fresh power-on Machine, exactly what the frame engine hands the reset vector.
 * Entry 2 is crafted: a populated RAM image with every boot-driven latch set away from its boot value, so each
 * wipe/seed write is observable. Both sides must end in the same RAM (stack window masked), latches and
 * watchdog count, and both must hand off to the main loop. Teeth: broken twins built from the real stages.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { captures, compare, warmEntry, romsPresent } from "./_coldBoot.js";
import { coldBoot as cand } from "../coldBoot.js";
import { marchTestWorkRam } from "../marchTestWorkRam.js";
import { wipeVideoAndHardwareLatches } from "../wipeVideoAndHardwareLatches.js";
import { loc_0000 as oracle } from "../../translated/loc_0000.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

test("EQUAL (captured power-on entry): coldBoot matches the oracle's full boot", { skip }, () => {
  const [entry] = captures()[0x0000];
  assert.equal(compare(oracle, cand, entry), null);
});

test("EQUAL (crafted warm entry): coldBoot overwrites a populated machine like the oracle", { skip }, () => {
  const entry = warmEntry(captures()[0x0000][0]);
  assert.equal(compare(oracle, cand, entry), null);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const entry = warmEntry(captures()[0x0000][0]);
  const skipsWipe = (m) => marchTestWorkRam(m, 32); // no hardware wipe: OBJRAM and latches left as found
  const noHandoff = (m) => { wipeVideoAndHardwareLatches(m); }; // drops the main-loop hand-off
  assert.ok(compare(oracle, skipsWipe, entry), "skip-wipe twin escaped");
  assert.ok(compare(oracle, noHandoff, entry), "no-hand-off twin escaped");
});
