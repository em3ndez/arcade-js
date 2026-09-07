// SPDX-License-Identifier: GPL-3.0-only
// flagObjectHitsOnPlayer — sweep every diving object against the player ship for a collision.
//
// WHAT IT IS
//   The outer loop of one of the four per-frame collision sweeps. Gated on the object subsystem being
//   enabled, it walks all seven records of the primary object table and hands each to
//   flagObjectHitOnPlayer, which does the actual box-test and raises the player-death event on a hit.
//
// ROLE IN THE MACHINE
//   This is the "object vs player" hazard test (see mechanisms.md "Collisions and the hit response").
//   The seven objects are Galaxian's live divers/attackers; each record lives at OBJ_TABLE (0x42d0)
//   spaced OBJ_STRIDE (0x20) apart. Any diver whose position overlaps the player raises HIT_EVENT_FLAG
//   (0x4204), which handlePlayerHitEvent (0x12ed) later consumes as the player's death. The whole sweep
//   is gated on OBJ_ACTIVE_FLAG (0x4200) bit0 — while the object subsystem is disabled there are no
//   attackers to collide with, so the routine is a no-op.
//
// ROM 0x129e.  Grounding: [seen].
//
// LIVE-OUT: nothing directly; delegates each per-object test to flagObjectHitOnPlayer,
// which may set HIT_EVENT_FLAG and score/deactivate the struck object.
import { flagObjectHitOnPlayer } from "./flagObjectHitOnPlayer.js";
import { OBJ_ACTIVE_FLAG, OBJ_TABLE } from "./names.js";

const OBJ_COUNT = 7;
const OBJ_STRIDE = 32;

export function flagObjectHitsOnPlayer(m) {
  const { mem8 } = m;

  // Object subsystem gate: with OBJ_ACTIVE_FLAG (0x4200) bit0 clear there are no live divers — bail.
  if ((mem8[OBJ_ACTIVE_FLAG] & 1) === 0) return; // subsystem disabled

  // Test each of the seven object records in turn, addressing record i at OBJ_TABLE + i*OBJ_STRIDE.
  for (let i = 0; i < OBJ_COUNT; i++) {
    flagObjectHitOnPlayer(m, OBJ_TABLE + i * OBJ_STRIDE);
  }
}
