// SPDX-License-Identifier: GPL-3.0-only
import { setActorAnimation } from "./setActorAnimation.js";
import { ANIM_TABLE_3829 } from "./names.js";
/**
 * restartActorAnimUnlessPhaseAdvanced — (re)start one actor's animation, but only while that
 * actor is still in its early phase. [seen]  (ROM 0x141c)
 *
 * WHAT IT IS
 * ----------
 * Every moving thing in the game — a hunter riding a rope, a spawned prize, a struck object —
 * is tracked by an ACTOR RECORD, a fixed-layout block of bytes in work RAM. This routine is a
 * small guard the actor spawn/queue machinery calls when it wants to arm (or re-arm) an
 * actor's animation: it points the record at an animation sequence and rewinds that sequence
 * to its first frame, so the actor begins playing the look from the start.
 *
 * The guard is a PHASE GATE. One byte of the record, at offset +6, tracks how far the actor
 * has progressed through its own little life cycle. Once that phase byte has reached 2 — the
 * actor is past its opening moments and settled into its real job — the routine refuses to
 * touch the record at all: an established actor must keep the animation it is already playing,
 * not be yanked back to a fresh restart every time the queue step happens to run. Only while
 * the phase byte is still below 2 does it (re)start the animation as asked.
 *
 * ROLE IN THE MACHINE
 * -------------------
 * This sits underneath restartActorAnimIfFlagBit0Set (ROM 0x1389), which first tests bit 0 of
 * the record's flag byte (+8) and, when that bit is set, falls through into here. The sequence
 * this routine installs is ANIM_TABLE_3829 (ROM 0x3829) — a four-frame {attribute, tile,
 * colour} animation loop — the animation for this class of actor.
 *
 * GROUNDING: [seen].
 *
 * LIVE-OUT: memory only — either nothing at all (the phase gate was closed and the record was
 * left exactly as it was) or the cleared flag field (rec+8) together with the three animation
 * bytes the animation helper stamps into the record (rec+0x0C..rec+0x0E: the two-byte
 * sequence pointer plus the frame index, rewound to 0).
 */

const PHASE_ADVANCED_LIMIT = 0x02; // phase byte (rec+6) at/above this: actor already advanced -> leave the record untouched

export function restartActorAnimUnlessPhaseAdvanced(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // PHASE GATE. Read the actor's phase byte at record offset +6 and bail out the moment the
  // actor has already advanced (phase >= 2). An established actor keeps whatever animation it
  // is currently playing; only a freshly spawned / still-early actor is eligible for the
  // (re)start performed below. Returning here leaves the whole record exactly as it was.
  if (mem8[rec + 0x06] >= PHASE_ADVANCED_LIMIT) return;

  // Clear the flag byte at record offset +8 — the very byte restartActorAnimIfFlagBit0Set
  // tests (bit 0) on its way in here. Zeroing it resets the actor's spawn/queue flag so the
  // animation restart proceeds from a clean state.
  mem8[rec + 0x08] = 0x00;

  // Point the record at its animation sequence (ANIM_TABLE_3829, ROM 0x3829) and rewind it to
  // the beginning: setActorAnimation writes the two-byte sequence pointer into the record's
  // anim field (rec+0x0C / rec+0x0D) and forces the frame index at rec+0x0E to 0, so the actor
  // plays the four-frame sequence from its first frame.
  setActorAnimation(m, rec, ANIM_TABLE_3829);
}
