// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0593 — memory-equivalent to the frozen oracle at ROM 0x0593. Two memory live-outs: the +1 bump
 * of the counted byte at 0x400a and the 32-byte strided reseed of the shadow field (0x4021,0x4023,..)
 * from the template at 0x1d71. HL is scratch here (the seed copy clobbers it to a don't-care), so this
 * is a pure memory routine — ramDiff only. The craft seeds HL at the fall-in pointer 0x4009 and
 * corrupts the first shadow cell so the reseed is observable. Teeth: no-op, bump-only (skips the
 * reseed), and seed-only (skips the bump) twins.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { advanceSequenceStateAndReseedObjectShadow as cand } from "../advanceSequenceStateAndReseedObjectShadow.js";
import { loc_0593 as oracle } from "../../translated/loc_0593.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const PTR = 0x4009;     // fall-in pointer; the routine advances it to 0x400a
const COUNTED = 0x400a; // byte bumped by the advance
const SHADOW0 = 0x4021; // first cell of the strided shadow field
const SRC0 = 0x1d71;    // template the field is reseeded from

// Seed HL at the fall-in pointer and corrupt the first shadow cell so the reseed is observable.
const entry = () => craft((mem, mm) => {
  mm.regs.hl = PTR;
  mem[SHADOW0] = mem[SHADOW0] ^ 0xff;
  mm.push16(0x9999);
});

test("EQUAL (crafted): loc_0593 == oracle bumps the counted byte and reseeds the shadow", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, entry()), null, "loc_0593 diverged");
  const a = entry(); a.routines = STUBS; oracle(a);
  const before = entry();
  assert.equal(a.mem8[COUNTED], (before.mem8[COUNTED] + 1) & 0xff, "positive control: counted byte not bumped");
  assert.equal(a.mem8[SHADOW0], before.mem8[SRC0], "positive control: shadow cell not reseeded from the template");
  console.log("  EQUAL: loc_0593 == oracle — counted byte bumped, shadow field reseeded");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const bumpOnly = (m) => { m.mem8[COUNTED]++; };                                        // skips the reseed
  const seedOnly = (m) => { cand(m); m.mem8[COUNTED] = (m.mem8[COUNTED] - 1) & 0xff; };  // undoes the bump
  assert.ok(ramDiff(oracle, noOp, entry()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, bumpOnly, entry()), "the bump-only twin escaped");
  assert.ok(ramDiff(oracle, seedOnly, entry()), "the seed-only twin escaped");
  console.log("  TEETH: no-op, bump-only, seed-only all caught");
});
