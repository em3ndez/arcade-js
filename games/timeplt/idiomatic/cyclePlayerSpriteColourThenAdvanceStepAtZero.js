// SPDX-License-Identifier: GPL-3.0-only
/** cyclePlayerSpriteColourThenAdvanceStepAtZero — one frame of an animation that counts down and, while it does, drives a sprite
 * entry's colour field from a single bit of the count, so the colour holds for four frames at a
 * time; the top two bits of that byte, where the shape's mirroring lives, are left alone. The
 * frame on which the count is found already at zero also moves the step cell on, and the count
 * still steps that frame, wrapping below zero. LIVE-OUT: memory. */

import { u8 } from "../../../core/int.js";
import { INTRO_ANIMATION_STEP, PLAYER_SPRITE_ATTRIBUTE, SPRITE_COLOUR_CYCLE_COUNTDOWN } from "./names.js";


const MIRROR_BITS = 0xc0;
const ALTERNATING_BIT = 0x04;
const FIRST_COLOUR = 63;
const SECOND_COLOUR = 55;

const NEXT_STEP = 3;

export function cyclePlayerSpriteColourThenAdvanceStepAtZero(m) {
  const { mem8 } = m;
  const remaining = mem8[SPRITE_COLOUR_CYCLE_COUNTDOWN];

  if (remaining === 0) mem8[INTRO_ANIMATION_STEP] = NEXT_STEP;

  const colour = (remaining & ALTERNATING_BIT) === 0 ? FIRST_COLOUR : SECOND_COLOUR;
  mem8[PLAYER_SPRITE_ATTRIBUTE] = (mem8[PLAYER_SPRITE_ATTRIBUTE] & MIRROR_BITS) + colour;
  mem8[SPRITE_COLOUR_CYCLE_COUNTDOWN] = u8(remaining - 1);
}
