// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2e9c — animation-string terminator handler: rewind the walk pointer to the string base and
 * fire the wrap sound, then hand off to the object-update convergence point.
 *
 * Reached from the per-object scan the instant an object's animation-string walk reads the 0x7F
 * terminator byte. It rewinds the string pointer back to the base of the animation string so the
 * walk loops, and fires a sound trigger. It then falls straight into the object-update convergence
 * point, which stores the now-rewound pointer back into the object record, runs the end-of-walk
 * boundary test, and mirrors the object's position to its sprite — advancing both scan cursors.
 *
 * Because the pointer is ALWAYS rewound to the base, whatever value the walk left is dead: the
 * incoming pointer is overwritten here and nothing reads it. The convergence point takes the
 * pointer in a register, so the rewind is expressed as a register load handed straight to it.
 *
 * The terminator has just been read when this routine runs, so on the end-of-walk transition arm —
 * the object at or past the far X limit — the convergence point clears the same sound latch back to
 * 0. The write made here therefore only SURVIVES on the non-transition arm. That is not a conflict
 * between the two: it is one shared tail doing both jobs in sequence.
 *
 * WHY THE NAME IS STILL AN ADDRESS. The mechanism — rewind the string pointer, fire a sound — is
 * plain from the body, but which object and which animation this drives, and which sound the latch
 * selects, are not derivable from this file.
 *
 * Reads: nothing from memory — its inputs are registers. Writes: the wrap sound latch, plus
 * everything the convergence point writes: the rewound pointer stored back into the record, and on
 * the transition arm the record's state byte, the two sound latches and two sprite-position bytes.
 * LIVE-OUT: those writes, plus the registers the convergence tail leaves — object cursor advanced
 * by 16, sprite cursor by 4, remaining-object count preserved, step value 4.
 */

import { SND_TRIGGER } from "./names.js";
import { advanceSpringArcAndDropAtTravelEnd } from "./advanceSpringArcAndDropAtTravelEnd.js"; // the object-update convergence point

const ANIMATION_STRING_BASE = 0x39aa; // base of the object animation string — the walk's rewind target

/**
 * @param {object} m  the machine. The object/sprite cursors and the last-read string byte arrive
 *                    in registers; the rewound pointer is loaded into registers for the tail.
 * @returns {void}
 */
export function loc_2e9c(m) {
  const { regs, mem } = m;

  // Rewind the animation-string pointer to the base so the walk loops. The convergence point
  // takes the pointer in a register, so the reset is a register load handed straight to it.
  regs.hl = ANIMATION_STRING_BASE;

  // Fire the string-wrap sound trigger.
  mem.write8(SND_TRIGGER + 3, 0x03);

  // Fall into the object-update convergence point: store the rewound pointer back into the object
  // record, run the end-of-walk boundary test, and mirror the position to the sprite (advancing
  // both scan cursors).
  advanceSpringArcAndDropAtTravelEnd(m);
}
