// SPDX-License-Identifier: GPL-3.0-only
import { zeroSpriteListAndActorArena } from "./zeroSpriteListAndActorArena.js";
import { armTileFillFromPlayfieldBase } from "./armTileFillFromPlayfieldBase.js";
import {
  SCRIPT_FRAME_TIMER,
  ATTRACT_SUBSTATE,
  INTRO_DELAY_CKSUM_WORD,
  ATTRACT_SCRIPT_TABLE_BASE,
} from "./names.js";
/**
 * tickAttractDelayThenReseedAndAdvance — attract sub-state 3: a per-frame countdown gate.
 *
 * Decrement the attract script frame timer; while it is still running, return and do
 * nothing else. On the tick it reaches zero, zero the board-init RAM regions and re-arm
 * the row-by-row tile fill, advance the attract sub-state one step, and seat the script
 * table base into the attract cursor word (a 16-bit little-endian store).
 *
 * LIVE-OUT: none. The dispatcher resumes in a shared epilogue that reloads its own
 * registers from memory, so nothing this routine leaves behind is read back.
 */
export function tickAttractDelayThenReseedAndAdvance(m) {
  const { mem8 } = m;

  const remaining = (mem8[SCRIPT_FRAME_TIMER] - 1) & 0xff;
  mem8[SCRIPT_FRAME_TIMER] = remaining;
  if (remaining !== 0) return; // still counting down

  zeroSpriteListAndActorArena(m); // zero the sprite display list + actor/object arena
  armTileFillFromPlayfieldBase(m); // re-arm the row-by-row tile fill

  mem8[ATTRACT_SUBSTATE] = mem8[ATTRACT_SUBSTATE] + 1; // advance the sub-state (byte write wraps)

  const lo = ATTRACT_SCRIPT_TABLE_BASE & 0xff;
  const hi = ATTRACT_SCRIPT_TABLE_BASE >> 8;
  mem8[INTRO_DELAY_CKSUM_WORD] = lo; // seat the table base into the cursor word, little-endian
  mem8[INTRO_DELAY_CKSUM_WORD + 1] = hi;
}
