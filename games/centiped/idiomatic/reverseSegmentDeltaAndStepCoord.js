// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { negateA } from "./negateA.js";
import { loc_44, loc_54, loc_74 } from "./names.js";
import { advanceSegmentLoopIndex } from "./advanceSegmentLoopIndex.js";

/**
 * reverseSegmentDeltaAndStepCoord — the direction-reversal step handler in the per-segment walk.
 *
 * Role in the machine: this is the tail the mover jumps to when a segment must turn — it has run into
 * a wall band or an aligned cell and needs to flip its travel direction. It negates the segment's
 * heading delta in place, and (the first time a turn happens, before the neighbour link is set) it
 * also seeds the follow-the-leader link so the segment behind will drag along the same reversal, and
 * nudges the coordinate a notch in the new direction so the turn is visible immediately. Then it
 * falls through to the loop tail, which moves the walk on to the next segment.
 *
 * ROM: the delta-flip step in the centipede segment-walk chain. Grounding: [code] — read from
 * behaviour; $44 (heading delta), $54 (coordinate), $74 (neighbour link) are bare zero-page segment
 * fields indexed by the slot number.
 *
 * Live-out: writes mem8[$44+X] (flipped delta); may write mem8[$74+X] (link seed) and mem8[$54+X]
 * (nudged coordinate); then whatever advanceSegmentLoopIndex mutates as it steps the sweep on.
 */
export function reverseSegmentDeltaAndStepCoord(m, x = m.regs.x) {
  const { mem8 } = m;

  // Reverse the segment's travel direction by two's-complement negating its heading delta $44+X and
  // writing the flipped value straight back. This is the actual "turn around" — everything below
  // just propagates the consequences of it.
  const deltaAddr = (loc_44 + x) & 0xff;
  const flipped = negateA(m, mem8[deltaAddr]); // reverse travel direction
  mem8[deltaAddr] = flipped;

  // The neighbour link $74+X couples this segment to the one behind it. If it is already set the turn
  // has already been propagated on a prior frame, so we simply move on to the next segment.
  const linkAddr = (loc_74 + x) & 0xff;
  if (mem8[linkAddr] !== 0) return advanceSegmentLoopIndex(m, x); // neighbour already linked -> next segment

  // First reversal: seed the link with the *negative magnitude* of the flipped delta (i.e. force it
  // negative regardless of the delta's sign). This is the value the trailing segment reads to know
  // how far/which way to swing so the body follows the head around the turn like a train on a track.
  mem8[linkAddr] = (flipped & 0x80) ? flipped : negateA(m, flipped);

  // Nudge this segment's coordinate $54+X one step (+/-4 by the flipped delta's sign) so the reversal
  // shows on screen this frame instead of stalling for a tick at the turning point.
  const coordAddr = (loc_54 + x) & 0xff;
  mem8[coordAddr] = u8(mem8[coordAddr] + ((flipped & 0x80) ? -4 : 4));

  // Fall through to the loop tail: step the sweep cursor to the previous slot (or end the walk).
  return advanceSegmentLoopIndex(m, x); // fall through to the next-segment step
}
