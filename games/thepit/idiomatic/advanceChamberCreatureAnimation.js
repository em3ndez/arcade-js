// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceChamberCreatureAnimation — the per-frame phase clock for the chamber creature's sprite-flip
 * animation: tick the phase countdown and route the frame to one of three shared continuations.
 * ROM 0x2fc0. (§2.8)
 *
 * The chamber creature's sprite flips between two tile codes on a slow cadence. This
 * routine owns that cadence's clock. Once per frame it ticks a phase countdown, and
 * where the frame goes next depends on the tick:
 *   - countdown still running, off-beat frame: nothing to animate — go straight to
 *     the publish tail that writes the creature's screen position.
 *   - countdown still running, on-beat frame (every fourth): run the position-step body
 *     that walks the creature's position.
 *   - countdown expired: reload it to eight, flip the tile to its other code,
 *     and hand the chosen tile to the commit tail (which stores it, then continues
 *     into the same position-step body).
 *
 * The flip alternates between the two tile codes: whenever the tile is
 * currently the first, it becomes the second, and from anything else it becomes the
 * first — a strict two-state toggle. The chosen tile is handed to the commit tail
 * setChamberCreatureFrame through the machine register it still reads (a genuine oracle boundary, so
 * it is set on the machine rather than passed as an argument). The two other
 * continuations (the position-step body and the publish tail) are not yet decompiled, so
 * they stay registry hand-offs. All three are tail jumps: this routine has no return
 * of its own, so the continuation's return unwinds straight back to advanceChamberCreatureAnimation's caller,
 * which is why each delegation IS an exit.
 *
 * This is the phase clock for the chamber creature's sprite-flip animation (§2.8): the phase counter is
 * CHAMBER_CREATURE_ANIM_PHASE (0x80e3) and the flip-tile cell CHAMBER_CREATURE_FRAME (0x80dc), both named in names.js.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2fc0.test.js.
 * GATE:     crafted-entry — this subsystem never enters through this address in
 *           attract (the sibling monolith advanceChamberCreature inlines the same body instead of
 *           calling it), so real machine states are captured at that sibling and the
 *           target is invoked on clones of them. The two still-untranslated tails
 *           (0x2fe3 position-step body, 0x3029 publish) are delegated to ONE identical
 *           stub each, installed on both sides at once, so a mis-route is visible but
 *           the stub can never manufacture a difference. EQUAL over every naturally
 *           occurring phase/tile state plus an exhaustive sweep of the phase counter
 *           (all 256 values) crossed with the flip tiles; the teeth twins are caught.
 * LIVE-OUT: memory-only — the phase counter and, on the reload frame, the flip tile;
 *           the routine tail-jumps, so its caller consumes no register and the chosen
 *           continuation owns everything after the hand-off, identically both sides.
 *           The registers/flags it leaves behind are dead.
 * NAMES:    CHAMBER_CREATURE_ANIM_PHASE (0x80e3, the animation phase counter) and CHAMBER_CREATURE_FRAME
 *           (0x80dc, the two-state flip tile) from names.js. The commit tail is the decompiled
 *           setChamberCreatureFrame; the position-step body (0x2fe3) and publish tail (0x3029) are oracle.
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
    // Countdown still running.
    if (phase % 4 !== 0) {
      // Off-beat frame: nothing to animate — jump to the publish tail.
      return m.call(0x3029);
    }
    // On-beat frame (every fourth): run the position-step body.
    return m.call(0x2fe3);
  }

  // Countdown expired: reload it and flip the tile to its other code.
  mem8[CHAMBER_CREATURE_ANIM_PHASE] = 8;
  const tile = mem8[CHAMBER_CREATURE_FRAME];
  m.regs.a = tile === FLIP_TILE_A ? FLIP_TILE_B : FLIP_TILE_A;

  // Hand the chosen tile to the commit tail; its return goes to our caller, so this
  // is advanceChamberCreatureAnimation's exit.
  return setChamberCreatureFrame(m);
}
