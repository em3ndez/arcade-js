// SPDX-License-Identifier: GPL-3.0-only
/**
 * resetScoreAndSoundQueue — blank the score bytes and the sound-command queue to zero.
 *
 * Part of both cold boot and new-game / round setup. It zeroes two fixed work-memory
 * blocks: the six running score bytes at SCORE_LO, reset to a clean zero score, and the
 * ten-byte sound-command queue at SOUND_HEAD (the ring head index plus its eight command
 * slots), so no stale sound request carries over the reset. It reads nothing and takes no
 * inputs, so it always leaves the same sixteen bytes zeroed whatever state it enters from.
 */
import { SCORE_LO, SOUND_HEAD } from "./names.js";

export function resetScoreAndSoundQueue(m) {
  const { mem8 } = m;

  // Reset the score block.
  for (let i = 0; i < 6; i++) mem8[SCORE_LO + i] = 0;

  // Clear the sound-command queue: the ring head index plus its eight command slots.
  for (let i = 0; i < 10; i++) mem8[SOUND_HEAD + i] = 0;
}
