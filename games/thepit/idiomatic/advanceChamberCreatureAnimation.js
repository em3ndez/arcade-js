// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceChamberCreatureAnimation — the per-frame phase clock for the chamber creature's
 * sprite-flip animation: tick the countdown and route the frame to one of three continuations.
 *
 * The creature's sprite flips between two tile codes on a slow cadence. Once per frame this
 * routine ticks the countdown CHAMBER_CREATURE_ANIM_PHASE. While it runs, an off-beat frame
 * jumps to the publish continuation and an on-beat frame (every fourth) runs the position-step
 * body. When it expires the routine reloads it to eight, flips CHAMBER_CREATURE_FRAME to its
 * other tile (a strict two-state toggle), and hands the chosen tile to the commit continuation.
 * All three are tail jumps, so each delegation is an exit.
 */

import { setChamberCreatureFrame } from "./setChamberCreatureFrame.js";
import { CHAMBER_CREATURE_ANIM_PHASE, CHAMBER_CREATURE_FRAME } from "./names.js";


// The two tile codes the creature's frame toggles between.
const FLIP_TILE_A = 56;
const FLIP_TILE_B = 57;

export function advanceChamberCreatureAnimation(m) {
  const { mem8 } = m;

  // Tick the phase countdown (an 8-bit down-counter, so it wraps 0 -> 255).
  const phase = (mem8[CHAMBER_CREATURE_ANIM_PHASE] - 1 + 256) % 256;
  mem8[CHAMBER_CREATURE_ANIM_PHASE] = phase;

  if (phase !== 0) {
    if (phase % 4 !== 0) {
      // Off-beat frame: nothing to animate — jump to the publish continuation.
      return m.call(0x3029);
    }
    // On-beat frame (every fourth): run the position-step body.
    return m.call(0x2fe3);
  }

  // Countdown expired: reload it and flip the tile to its other code.
  mem8[CHAMBER_CREATURE_ANIM_PHASE] = 8;
  const tile = mem8[CHAMBER_CREATURE_FRAME];
  const chosenTile = tile === FLIP_TILE_A ? FLIP_TILE_B : FLIP_TILE_A;

  // Hand the chosen tile to the commit continuation; this is the routine's exit.
  return setChamberCreatureFrame(m, chosenTile);
}
