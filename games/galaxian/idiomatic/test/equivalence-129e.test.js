// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_129e — crafted-entry equivalence vs the frozen sweep at ROM 0x129e.
 * Gated by OBJ_ACTIVE_FLAG (0x4200) bit0, it walks the seven object structs at 0x42d0 (stride 0x20)
 * through the per-object player-collision test; a hit raises HIT_EVENT_FLAG (0x4204) and awards the kill
 * (deactivate + score request). All live-outs are work RAM (the caller's pipeline reads none of its
 * registers back), so ramDiff carries the whole verdict. Paths: enabled with a manufactured hit on the
 * first object (the other six deactivated for a crisp control); and the gate closed (routine bails,
 * nothing touched). Teeth: no-op, flag-only, deactivate-only, and a gate-ignoring twin.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { loc_129e as cand } from "../loc_129e.js";
import { loc_129e as oracle } from "../../translated/loc_129e.js";

const ENABLE = 0x4200;      // OBJ_ACTIVE_FLAG
const HIT_FLAG = 0x4204;    // HIT_EVENT_FLAG
const PLAYER_X = 0x4202;
const OBJ = 0x42d0;         // first object struct
const STRIDE = 0x20;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

// A near-window hit on object 0: (obj+3)+0x21 = 1 (< 5 -> low window); player X == obj+4 -> delta 0,
// (0+7) < 15 -> hit. Objects 1..6 deactivated so object 0 is the sole actor.
function pokeHit(mem, mm) {
  mm.push16(0x9999);
  mem[PLAYER_X] = 0x40;
  mem[HIT_FLAG] = 0;
  mem[OBJ + 0] = 1;      // active
  mem[OBJ + 2] = 7;      // state byte, nonzero so the kill's clear is observable
  mem[OBJ + 3] = 0xe0;   // -> band 1 (low window)
  mem[OBJ + 4] = 0x40;   // == player X -> delta 0
  mem[OBJ + 7] = 0x30;   // band-scan field
  for (let k = 1; k < 7; k++) mem[OBJ + k * STRIDE] = 0; // deactivate the rest
}

const enabled = () => craft((mem, mm) => { pokeHit(mem, mm); mem[ENABLE] = 1; });
const gateClosed = () => craft((mem, mm) => { pokeHit(mem, mm); mem[ENABLE] = 0; });

test("EQUAL (crafted): loc_129e == oracle sweeps and flags a hit", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, enabled()), null, "loc_129e diverged on the enabled sweep");
  const a = enabled(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[HIT_FLAG], 1, "positive control: oracle did not raise the hit flag");
  assert.equal(a.mem8[OBJ + 0], 0, "positive control: oracle did not deactivate the struck object");
  assert.equal(a.mem8[OBJ + 1], 1, "positive control: (obj+1) not set by the kill");
  assert.equal(a.mem8[OBJ + 2], 0, "positive control: state byte not cleared by the kill");
});

test("EQUAL (crafted): loc_129e == oracle bails when disabled", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, gateClosed()), null, "loc_129e diverged on the gate-closed path");
  const a = gateClosed(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[OBJ + 0], 1, "positive control: disabled -> object left active");
  assert.equal(a.mem8[HIT_FLAG], 0, "positive control: disabled -> hit flag untouched");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const flagOnly = (m) => { m.mem8[HIT_FLAG] = 1; };           // never awards the kill
  const deactivateOnly = (m) => { m.mem8[OBJ + 0] = 0; };      // never raises the flag / scores
  // gate-ignoring twin: does the hit's work even though the gate is closed.
  const ignoreGate = (m) => { m.mem8[OBJ + 0] = 0; m.mem8[OBJ + 1] = 1; m.mem8[HIT_FLAG] = 1; };
  assert.ok(ramDiff(oracle, noOp, enabled()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, flagOnly, enabled()), "flag-only twin escaped");
  assert.ok(ramDiff(oracle, deactivateOnly, enabled()), "deactivate-only twin escaped");
  assert.ok(ramDiff(oracle, ignoreGate, gateClosed()), "gate-ignoring twin escaped");
});
