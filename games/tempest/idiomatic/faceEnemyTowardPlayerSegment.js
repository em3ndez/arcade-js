// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { ENEMY_SEGMENT, PLAYER_SEGMENT, ENEMY_SLOT_FLAGS } from "./names.js";
import { signedSegmentDelta } from "./signedSegmentDelta.js";

/**
 * faceEnemyTowardPlayerSegment — aim enemy slot x's turn side toward the player. ROM 0x9d67.
 *
 * Role in the machine: a flipper (and its kin) walks around the rim of the tube by hopping between
 * adjacent lanes. Which way it should turn — clockwise or counter-clockwise — is the shorter way around
 * the ring toward the player's lane. This routine encodes that decision as bit6 of the slot's flag byte,
 * so the later stepping code knows which neighbouring lane to hop into.
 *
 * Behavior: it reads the slot's own segment loc_2b9,x (ENEMY_SEGMENT) and takes the signed ring distance
 * from the player's segment loc_200 (PLAYER_SEGMENT) to it via signedSegmentDelta (which wraps the 16-lane
 * ring into a signed value). The delta's sign says which way is shorter: if negative (top bit set) it
 * clears bit6 of the slot's flag byte loc_283,x (ENEMY_SLOT_FLAGS); otherwise it sets bit6.
 *
 * Live-out: bit6 of loc_283,x — the turn-side flag consumed by toggleEnemyTurnSide / the flip stepper.
 * Grounding: [seen].
 */
// Fetch slot x's target and a shared byte, derive a signed difference, then flip bit6 of
// slot x's flag byte: clear it when the difference's top bit is set, set it otherwise.
export function faceEnemyTowardPlayerSegment(m, x = m.regs.x) {
  const { mem8 } = m;
  const y = mem8[u16(ENEMY_SEGMENT + x)];                       // slot x's own lane
  const diff = signedSegmentDelta(m, mem8[PLAYER_SEGMENT], y);  // signed ring distance to the player
  const e = u16(ENEMY_SLOT_FLAGS + x);
  if (diff & 0x80) mem8[e] &= 0xbf; // top bit set -> clear bit6
  else mem8[e] |= 0x40;             // else set bit6
}
