// SPDX-License-Identifier: GPL-3.0-only
import { PLAYER_SHOT_DESC } from "./names.js";
import { loadSpriteDescriptor } from "./loadSpriteDescriptor.js";

/**
 * loadPlayerShotDescriptor — decode the player-shot's sprite descriptor.
 *
 * WHAT IT IS
 *   A thin front door that decodes the five-byte sprite descriptor for the player's shot, leaving the
 *   registers set up (graphics pointer in DE, coordinate in A, C/B loaded, HL repointed at the shot's
 *   screen-coordinate word C:A) for the code that draws or steps the shot.
 *
 * ROLE IN THE MACHINE
 *   PLAYER_SHOT_DESC (0x2027) is the fixed five-byte descriptor record for the player's single shot.
 *   loadSpriteDescriptor (0x1a3b) is the shared decoder: reading forward from the record it takes the
 *   two-byte graphics pointer into DE, a coordinate byte into A, two more bytes into C and B, and finally
 *   sets HL = C:A (the composite screen-coordinate word). This routine just supplies the fixed record
 *   address and delegates (it never falls through — a tail-jump to 0x1a3b).
 *
 * ROM 0x0430-0x0435.  Grounding: [seen].
 *
 * LIVE-OUT: registers set by loadSpriteDescriptor — HL = C:A, DE = graphics pointer, A = coordinate byte,
 * C and B loaded from the descriptor.
 */
export function loadPlayerShotDescriptor(m) {
  // Decode the player-shot's 5-byte descriptor at PLAYER_SHOT_DESC via the shared descriptor loader.
  return loadSpriteDescriptor(m, PLAYER_SHOT_DESC);
}
