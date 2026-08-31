// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { advanceActorAnimationFrame } from "./advanceActorAnimationFrame.js";
import { ACTOR_TABLE, GRAB_ACTIVE_FLAG } from "./names.js";
/**
 * advanceActorAnimationsUnlessGrabbing — advance the on-screen animation of the player and its three
 * companion actors by one frame, unless a rope-grab is in progress.
 *
 * WHAT IT IS. The player and a small cluster of actors alongside it all march through ONE shared
 * animation script — a byte stream of {tile, colour, delay} frames kept in work RAM. Each actor is
 * described by a fixed 0x18-byte record; the first four of those records (the player/lead actor at
 * ACTOR_TABLE, 0x8a80, and the three that follow one 0x18 stride apart at 0x8a98, 0x8ab0, 0x8ac8)
 * are animated in lockstep off that single shared cursor. This routine is the per-frame sweep that
 * hands each of those four records to the shared-cursor stepper (advanceActorAnimationFrame) in
 * turn, so the whole cluster advances together.
 *
 * ROLE IN THE MACHINE. It runs once per frame as part of the main animation update, but only while
 * the actors are free to animate. When a rope-grab is underway a latch (GRAB_ACTIVE_FLAG, 0x8d32) is
 * held set; this routine reads that latch first and, if set, skips the entire pass — the grabbed
 * actors freeze on their current frame until the grab resolves and the latch clears.
 *
 * ROM 0x22b1-0x22cf.  Grounding tag: [seen].
 *
 * LIVE-OUT (run path only): IX = the address of the fourth record it stepped, and DE = the record
 * stride (0x18). These are the loop's own leftovers — the stepper leaves IX/DE untouched, so after
 * the last step IX still points at the fourth record and DE still holds the stride that walked it
 * there. Both are surfaced for the caller. On the skip path (grab in progress) nothing is left.
 */
const RECORD_COUNT = 4; //     the player/lead record plus the three companion records animated with it
const RECORD_STRIDE = 0x18; // one actor record is 0x18 bytes; the next record sits one stride higher

export function advanceActorAnimationsUnlessGrabbing(m) {
  const { mem8 } = m;
  // Grab gate. GRAB_ACTIVE_FLAG (0x8d32) is the rope-grab-in-progress latch, set to 1 the moment a
  // grab fires. While it is non-zero the grabbed actors must hold still, so the whole animation pass
  // is abandoned before it starts and nothing is left behind for the caller.
  if (mem8[GRAB_ACTIVE_FLAG] !== 0) return; // grab in progress -> skip the pass

  // Walk the four lockstep records. Start at the base of the actor record array (ACTOR_TABLE,
  // 0x8a80 — record 0 is the player/lead actor) and step each record's animation forward one frame.
  // Every record shares the same script cursor, so the stepper reads and advances that one cursor as
  // it services each; stepping them in address order keeps them marching through the stream in order.
  let rec = ACTOR_TABLE;
  for (let i = 0; i < RECORD_COUNT; i++) {
    // Advance this actor's animation by one frame: tick its frame-hold countdown, and when that
    // expires pull the next {tile, colour, delay} step from the shared script into this record.
    advanceActorAnimationFrame(m, rec);
    // Advance to the next record — one 0x18 stride higher — but not past the last one, so `rec` is
    // left pointing at the fourth (final) record after the loop rather than one stride beyond it.
    if (i < RECORD_COUNT - 1) rec = u16(rec + RECORD_STRIDE);
  }
  // Surface the loop residue: IX = the fourth record just stepped, DE = the record stride (0x18).
  return [(m.regs.ix = rec), (m.regs.de = RECORD_STRIDE)];
}
