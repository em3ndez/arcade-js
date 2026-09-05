// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1d51 — crafted-entry equivalence vs the frozen dwell-tier tick at ROM 0x1d51.
 * Memory-only live-out: the routine decrements the tier byte one past HL and, on expiry (or if already
 * zero), re-seeds the screen-fill state (work-RAM cells 0x400b/0x4008/0x401a/0x4005). No register live-out
 * — the shipped re-seed treats HL/A as dead — so ramDiff (return-stack masked) is the whole check.
 * Three paths: still-counting (tier=2 -> 1, no re-seed), expiring (tier=1 -> 0 -> re-seed), already-zero
 * (tier=0 -> re-seed). IN0 bit 6 is cleared so the re-seed actually fires. Teeth: no-op, skip-re-seed,
 * wrong-cell twins each diverge.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { loc_1d51 as cand } from "../loc_1d51.js";
import { loc_1d51 as oracle } from "../../translated/loc_1d51.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const TIMER_BASE = 0x4008; // HL on entry; the tier byte the routine ticks is the next one
const TIER = 0x4009;
const SUBTIMER = 0x4008; // re-seed sets this to 0x20
const GAME_STATE = 0x4005; // re-seed clears this
const VRAM_PTR_LO = 0x400b; // re-seed sets the 16-bit fill cursor here to 0x5000

// Tier still counting: dec 2 -> 1, no re-seed. Only the tier byte changes.
const ticking = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mm.regs.hl = TIMER_BASE;
  mem[TIER] = 2;
});

// Tier at `t`: t=1 expires into a re-seed, t=0 re-seeds without ticking. Distinct sentinels in the
// re-seeded cells make the re-seed observable; IN0 bit 6 cleared so it fires.
const reseed = (t) => craft((mem, mm) => {
  mm.push16(0x9999);
  mm.regs.hl = TIMER_BASE;
  mm.io.in0 = 0;
  mem[TIER] = t;
  mem[SUBTIMER] = 0x99;
  mem[GAME_STATE] = 0x99;
  mem[VRAM_PTR_LO] = 0x99;
  mem[VRAM_PTR_LO + 1] = 0x99;
});

test("EQUAL (crafted): loc_1d51 == oracle, tier still counting down", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, ticking()), null, "loc_1d51 diverged while counting down");
  const a = ticking(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[TIER], 1, "positive control: oracle decremented the tier 2 -> 1");
  assert.equal(a.mem8[SUBTIMER], ticking().mem8[SUBTIMER], "positive control: no re-seed while counting");
  console.log("  EQUAL: tier 2->1, no re-seed");
});

test("EQUAL (crafted): loc_1d51 == oracle, tier expires -> re-seed", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, reseed(1)), null, "loc_1d51 diverged on the expiring path");
  const a = reseed(1); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[TIER], 0, "positive control: oracle ticked the tier 1 -> 0");
  assert.equal(a.mem8[SUBTIMER], 0x20, "positive control: re-seed armed the sub-timer to 0x20");
  assert.equal(a.mem8[GAME_STATE], 0, "positive control: re-seed cleared the game state");
  console.log("  EQUAL: tier 1->0 -> re-seed");
});

test("EQUAL (crafted): loc_1d51 == oracle, tier already zero -> re-seed", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, reseed(0)), null, "loc_1d51 diverged on the already-zero path");
  const a = reseed(0); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[SUBTIMER], 0x20, "positive control: re-seed armed the sub-timer to 0x20");
  console.log("  EQUAL: tier already 0 -> re-seed");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const decOnly = (m) => { m.mem8[TIER] = (m.mem8[TIER] - 1) & 0xff; }; // ticks but skips the re-seed
  const wrongCell = (m) => { m.mem8[TIMER_BASE] = (m.mem8[TIMER_BASE] - 1) & 0xff; };
  assert.ok(ramDiff(oracle, noOp, ticking()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, decOnly, reseed(1)), "skip-re-seed twin escaped");
  assert.ok(ramDiff(oracle, wrongCell, ticking()), "wrong-cell twin escaped");
  console.log("  TEETH: no-op, skip-re-seed, wrong-cell all caught");
});
