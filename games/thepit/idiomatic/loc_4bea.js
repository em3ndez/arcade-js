// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_4bea — blank the score bytes and the sound-command queue back to zero.  ROM 0x4bea.
 *
 * Part of both cold boot and new-game / round setup (called once from each). It zeroes
 * two fixed work-RAM blocks:
 *   - a 6-byte block at SCORE_LO (0x8031) — the running score bytes, reset to a clean
 *     zero score, and
 *   - a 10-byte block at the sound-command queue: the ring head index followed by the
 *     eight command slots, so no stale sound request carries over the reset.
 * It reads nothing and takes no inputs — the two bases and lengths are fixed — so it
 * always leaves the same 16 bytes zeroed no matter what state it is entered from.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4bea.test.js.
 * GATE:     crafted-entry — the real boot dispatch (where both blocks happen to be
 *           zero already, so it proves ONLY these bytes are touched), plus a DIRTIED
 *           entry: both blocks pre-filled with distinct garbage on both sides, proving
 *           it actually clears rather than reading zeros. Teeth: a short-count twin that
 *           leaves the last byte of each block untouched — invisible on the clean boot
 *           entry, caught on the dirtied one.
 * LIVE-OUT: memory-only — the 16 cleared bytes. The oracle's leftover loop counter and
 *           pointer are dead scratch: each caller's next act is another call, so nothing
 *           reads them before they are overwritten. No flags are touched end to end.
 * NAMES:    SOUND_HEAD (0x801e) from ram.js heads the 10-byte sound-queue block (head
 *           index + eight ring slots). SCORE_LO (0x8031) from ram.js heads the 6-byte
 *           score block (the running score bytes).
 */
import { SCORE_LO, SOUND_HEAD } from "./ram.js";

export function loc_4bea(m) {
  const { mem8 } = m;

  // Reset the score block.
  for (let i = 0; i < 6; i++) mem8[SCORE_LO + i] = 0;

  // Clear the sound-command queue: the ring head index plus its eight command slots.
  for (let i = 0; i < 10; i++) mem8[SOUND_HEAD + i] = 0;
}
