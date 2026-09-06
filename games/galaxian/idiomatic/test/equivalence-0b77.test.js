// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0b77 — crafted-entry equivalence vs the frozen sweep at ROM 0x0b77.
 * Gated by OBJ_ACTIVE_FLAG (0x4200) bit0, it scans 14 entries at 0x4260 (stride 5), running the
 * per-entry collision test; on a hit it clears the entry byte and raises HIT_EVENT_FLAG (0x4204).
 * All live-outs are work RAM, so ramDiff carries the whole verdict. Paths: enabled + a manufactured
 * hit on entry 0; and the gate closed (routine bails, nothing touched). Teeth: no-op, flag-only,
 * deactivate-only, and a gate-ignoring twin.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { flagProjectileHitsOnPlayer as cand } from "../flagProjectileHitsOnPlayer.js";
import { loc_0b77 as oracle } from "../../translated/loc_0b77.js";

const ENABLE = 0x4200;      // OBJ_ACTIVE_FLAG
const HIT_FLAG = 0x4204;    // HIT_EVENT_FLAG
const PLAYER_X = 0x4202;
const OBJ_BASE = 0x4260;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

// The per-entry check's band delta is E = 5 (the low byte of the DE stride the loop reuses), NOT the
// caller's E. Craft a near-band hit at delta 5 that would MISS at any other delta, so the sweep genuinely
// guards the aliasing: entry Y 231 (yShifted 6, within [5,14) -> near band), entry X 0x69 vs player X 0x64
// (dxBase 251, so (dxBase+5)&0xff = 0 < 11 hits; but yShifted 6 < 0x20 would take the far band and miss).
// regs.e is seeded to a deliberately-wrong 0x20 to prove the routine ignores the caller's E.
// Entry 0 active; HIT flag cleared so raising it is observable.
function pokeHit(mem, mm) {
  mm.regs.e = 0x20; // ignored by the routine (it derives the band delta from the DE stride = 5)
  mem[PLAYER_X] = 0x64;
  mem[HIT_FLAG] = 0;
  mem[OBJ_BASE + 0] = 1; // active
  mem[OBJ_BASE + 1] = 231; // Y  -> yShifted 6 (near band at delta 5)
  mem[OBJ_BASE + 3] = 0x69; // X  -> dxBase 251 (hits at delta 5; misses at delta 0x20)
  mm.push16(0x9999);
}

const enabled = () => craft((mem, mm) => { pokeHit(mem, mm); mem[ENABLE] = 1; });
const gateClosed = () => craft((mem, mm) => { pokeHit(mem, mm); mem[ENABLE] = 0; });

test("EQUAL (crafted): loc_0b77 == oracle sweeps and flags a hit", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, enabled()), null, "loc_0b77 diverged on the enabled sweep");
  const a = enabled(); oracle(a);
  assert.equal(a.mem8[OBJ_BASE], 0, "positive control: oracle did not deactivate the struck entry");
  assert.equal(a.mem8[HIT_FLAG], 1, "positive control: oracle did not raise the hit flag");
});

test("EQUAL (crafted): loc_0b77 == oracle bails when disabled", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, gateClosed()), null, "loc_0b77 diverged on the gate-closed path");
  const a = gateClosed(); oracle(a);
  assert.equal(a.mem8[OBJ_BASE], 1, "positive control: disabled -> entry left active");
  assert.equal(a.mem8[HIT_FLAG], 0, "positive control: disabled -> hit flag untouched");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const flagOnly = (m) => { m.mem8[HIT_FLAG] = 1; };                 // never deactivates
  const deactivateOnly = (m) => { m.mem8[OBJ_BASE] = 0; };           // never raises the flag
  const ignoreGate = (m) => { m.mem8[OBJ_BASE] = 0; m.mem8[HIT_FLAG] = 1; }; // scans while disabled
  assert.ok(ramDiff(oracle, noOp, enabled()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, flagOnly, enabled()), "flag-only twin escaped");
  assert.ok(ramDiff(oracle, deactivateOnly, enabled()), "deactivate-only twin escaped");
  assert.ok(ramDiff(oracle, ignoreGate, gateClosed()), "gate-ignoring twin escaped");
});
