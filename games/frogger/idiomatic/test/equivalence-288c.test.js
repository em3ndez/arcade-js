// SPDX-License-Identifier: GPL-3.0-only
/**
 * resetDiveSurfaceCounter — memory-equivalent to the frozen oracle at ROM 0x288C. When the busy latch
 * 0x814f is clear, BUMP the step gate 0x8150 by one, seed 0x8146/0x8147 from (0x819b & 0x0f)*8, and set
 * the busy latch; a set busy latch returns untouched. GATE: crafted-entry. Branches: armed (busy clear)
 * and guarded (busy set). RAM compared, stack masked (the oracle's block_289c call leaves a dead slot).
 * Teeth: no-op, a set-to-1 twin (proves the gate is BUMPED not set, unlike armTwoPairFigureFrame), and a
 * skip-seed twin; positive controls assert the bump, the seed, and the latch.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, STUBS } from "./_bootSetup.js";
import { resetDiveSurfaceCounter as cand } from "../resetDiveSurfaceCounter.js";
import { loc_288c as oracle } from "../../translated/loc_287e.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const BUSY = 0x814f, GATE = 0x8150, BUF = 0x819b, C6 = 0x8146, C7 = 0x8147;

const armed = () => craft((mem) => { mem[BUSY] = 0; mem[GATE] = 0x03; mem[BUF] = 0x35; mem[C6] = 0xaa; mem[C7] = 0xbb; });
const guarded = () => craft((mem) => { mem[BUSY] = 0x01; mem[GATE] = 0x07; mem[BUF] = 0x35; mem[C6] = 0xaa; mem[C7] = 0xbb; });

test("EQUAL (crafted): resetDiveSurfaceCounter == oracle on armed/guarded", { skip }, () => {
  for (const [name, mk] of [["armed", armed], ["guarded", guarded]]) {
    assert.equal(ramDiff(oracle, cand, mk()), null, `the ${name} path diverged`);
  }
  const a = armed(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[GATE], 0x04, "control: step gate bumped 0x03->0x04");
  assert.equal(a.mem8[C6], 0x28, "control: seed 0x8146 = (0x35 & 0x0f)*8 = 0x28");
  assert.equal(a.mem8[C7], 0x28, "control: seed 0x8147 = 0x28");
  assert.equal(a.mem8[BUSY], 1, "control: busy latch raised");
  const g = guarded(); g.routines = STUBS; oracle(g);
  assert.equal(g.mem8[GATE], 0x07, "control: guarded path leaves the gate untouched");
  console.log("  EQUAL: armed bump+seed+latch, guarded no-op; controls asserted");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const setTwin = (m) => { if (m.mem8[BUSY] === 0) { m.mem8[GATE] = 1; const s = (m.mem8[BUF] & 0x0f) * 8; m.mem8[C6] = s; m.mem8[C7] = s; m.mem8[BUSY] = 1; } }; // SETS gate=1 instead of bumping
  const skipSeed = (m) => { if (m.mem8[BUSY] === 0) { m.mem8[GATE] = (m.mem8[GATE] + 1) & 0xff; m.mem8[BUSY] = 1; } }; // omits the seed
  assert.ok(ramDiff(oracle, noOp, armed()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, setTwin, armed()), "set-to-1 twin escaped (gate must be BUMPED)");
  assert.ok(ramDiff(oracle, skipSeed, armed()), "skip-seed twin escaped");
  console.log("  TEETH: no-op, set-to-1, skip-seed all caught");
});
