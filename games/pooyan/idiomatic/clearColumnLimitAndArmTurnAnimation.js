// SPDX-License-Identifier: GPL-3.0-only
import { setActorAnimation } from "./setActorAnimation.js";
import { TURN_COLUMN_LIMIT, ANIM_SCRIPT_4212 } from "./names.js";

/**
 * clearColumnLimitAndArmTurnAnimation — put a moving actor into its "turn" animation with the
 * shared turn-column threshold cleared to zero. [seen]  (ROM 0x423a)
 *
 * WHAT IT IS
 * ----------
 * Enemies move horizontally across the playfield, and as an actor advances the X-movement
 * handler counts the tile columns it has crossed. When an actor's column count meets a
 * threshold, that handler flips the actor around — it plays a short "turn" animation and
 * reverses direction. The threshold is not per-actor; it lives in one shared cell,
 * TURN_COLUMN_LIMIT (0x8d4b), which the movement handler compares against the actor record's
 * column field (its +6 byte, masked to the low five bits, i.e. a column in 0..31).
 *
 * The two arming routines drive that threshold to one of two extremes — 0x00 or 0xff — to
 * select which turn behaviour the actor takes on from here. This routine is the "clear to zero"
 * flavour: it writes 0x00 into the threshold cell and then points the actor at the 0x4212
 * turn-animation script, restarting it. Its twin, latchColumnLimitAndArmTurnAnimation, is the
 * "latch to 0xff" flavour and arms a different script (0x4203). A single caller chooses between
 * the two per actor from a bit in that actor's record. "Interior-entry" marks this as one of the
 * two entry points that share the same animation-arming finish.
 *
 * ROLE IN THE MACHINE
 * -------------------
 * A small arm step inside the enemy object-movement subsystem. It neither moves the actor nor
 * draws anything itself; it stages the state the per-frame movement and animation handlers will
 * act on — the turn threshold, and the animation sequence the actor is now playing.
 *
 * LIVE-OUT: memory only — the shared turn-column threshold TURN_COLUMN_LIMIT (0x8d4b) and, via
 * the set-animation finish, the actor record's animation-pointer bytes (+0x0c/+0x0d) and its
 * frame index (+0x0e). It leaves nothing in a register the callers read.
 */
export function clearColumnLimitAndArmTurnAnimation(m, rec = m.regs.ix) {
  const { mem8 } = m; // byte-addressed view of work RAM

  // Clear the shared turn-column threshold to zero (TURN_COLUMN_LIMIT, 0x8d4b). This is the half
  // of the job that separates this arm from its 0xff-latching twin: with the threshold at zero,
  // the X-movement handler that compares an actor's column against this cell takes the
  // cleared-limit turn path on the actor's following steps.
  mem8[TURN_COLUMN_LIMIT] = 0x00;

  // Point the actor at the 0x4212 turn-animation script and start it over from its first frame.
  // ANIM_SCRIPT_4212 is a ROM table of {attribute, tile, colour} frames — the turning-around
  // look. setActorAnimation stores this pointer into the actor record (bytes +0x0c/+0x0d) and
  // forces its frame index (+0x0e) back to 0 so the turn plays from the top. This store is the
  // routine's final act; whatever setActorAnimation yields is what this routine yields.
  return setActorAnimation(m, rec, ANIM_SCRIPT_4212);
}
