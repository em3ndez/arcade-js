// SPDX-License-Identifier: GPL-3.0-only
/**
 * setClimbSpriteFrame — stamp Mario's climb-animation sprite for one climb step,
 * then flag him on the ladder and refresh his sprite record.  ROM 0x1d3f.
 *
 * Reached from the shared climb-animation body (loc_1d11) once it has moved Mario
 * one climb sub-step and chosen this step's climb frame code. Mario's sprite code
 * (MARIO_SPRITE_CODE) packs his horizontal-mirror flag in the top bit and an
 * animation code in the low bits. For a climb step this routine:
 *
 *   - toggles the mirror flag — the left/right leg wiggle that reads as climbing —
 *     while dropping the previous step's animation code, and
 *   - stamps in the new climb frame code the caller chose for this step
 *     (the climb codes are 3, 4, and 5, cycled by Mario's height on the ladder).
 *
 * It then falls straight into the shared climb-step tail (markOnLadderAndCommitSprite):
 * re-assert MARIO_ON_LADDER and copy Mario's freshly-computed position + sprite code
 * into his hardware sprite record. That tail is the whole chain's single return.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1d3f.test.js.
 * GATE:     crafted-entry — attract's 25m demo climbs, so real captured 0x1d3f
 *           dispatches cover the live path with both mirror states and multiple
 *           climb frame codes at entry; crafted entries additionally force the
 *           entry mirror bit both ways and sweep the frame code so the toggle and
 *           the frame stamp are each pinned. Teeth: a no-toggle twin, a
 *           dropped-frame twin, and a dropped-tail twin, all caught.
 * LIVE-OUT: memory-only — MARIO_SPRITE_CODE (0x6207) here, then MARIO_ON_LADDER
 *           (0x6215) and the four record bytes 0x694C..0x694F via the tail. No live
 *           registers/flags: the chain ends in a single unconditional return, so the
 *           oracle's residual registers/flags are dead ABI (the gate compares pc + SP,
 *           lined up by one modelled return, to backstop that).
 * NAMES:    MARIO_SPRITE_CODE from ram.js; the on-ladder flag + record copy delegate
 *           to the already-idiomatic markOnLadderAndCommitSprite (ROM 0x1D49).
 */

import { MARIO_SPRITE_CODE } from "../optimized/ram.js";
import { markOnLadderAndCommitSprite } from "./markOnLadderAndCommitSprite.js"; // ROM 0x1D49

// Bit 7 of the sprite code is Mario's horizontal-mirror flag (set = facing right).
const MIRROR_BIT = 0x80;

export function setClimbSpriteFrame(m, frame) {
  // Isolate the current mirror flag (discarding the previous animation code), flip
  // it for this step's wiggle, then combine it with the new climb frame code.
  const toggledMirror = (m.mem.read8(MARIO_SPRITE_CODE) & MIRROR_BIT) ^ MIRROR_BIT;
  m.mem.write8(MARIO_SPRITE_CODE, toggledMirror | frame);

  markOnLadderAndCommitSprite(m); // ROM 0x1D49 — re-flag on-ladder, refresh the sprite record
}
