// SPDX-License-Identifier: GPL-3.0-only
/**
 * setActorAnimation — point one actor at an animation sequence and start it over. [seen]
 * (ROM 0x381e)
 *
 * Every moving thing on screen — a hunter riding a rope, a struck object, a spawned prize —
 * is tracked by an ACTOR RECORD, a fixed-layout block of bytes in work RAM. Three of those
 * bytes describe what the actor is currently drawing: a two-byte pointer to an ANIMATION
 * SEQUENCE (a little table of frames the animation player walks), and a one-byte index saying
 * how far into that sequence the actor has got.
 *
 * This is the routine that changes what an actor is playing. Whenever the game decides an
 * actor should switch to a new look — an object lands and settles, a rope-grab begins, a
 * hunter takes a hit, a prize is awarded — it calls in here with the record and a pointer to
 * the new sequence. The ~40 animation-sequence tables scattered through the ROM (each a short
 * loop of {attribute, tile, colour} frames) are all installed through this one door.
 *
 * The work is three byte-stores into the record, at fixed offsets from its base:
 *   +0x0C / +0x0D  the 16-bit sequence pointer, stored little-endian (low byte first).
 *   +0x0E          the frame index, forced to 0 so the new sequence plays from its first
 *                  frame — this is the "restart" half of the job; without it the actor would
 *                  resume the new table at whatever frame the old one had reached.
 *
 * A PURE LEAF: it writes these three bytes and reads nothing. The sequence pointer and record
 * base both arrive as arguments.
 *
 * LIVE-OUT: memory only — the record's animation-pointer bytes (+0x0C..+0x0D) and its
 * frame index (+0x0E).
 */
export function setActorAnimation(m, rec = m.regs.ix, animPointer = m.regs.de) {
  const { mem8 } = m;

  const base = rec; // base address of the actor record being retargeted

  // Store the 16-bit animation-sequence pointer into the record's anim field, little-endian:
  // low byte at +0x0C, high byte at +0x0D. This is the WHAT — which frame table the actor now
  // plays.
  mem8[base + 0x0c] = animPointer; // sequence pointer, low byte
  mem8[base + 0x0d] = animPointer >> 8; // sequence pointer, high byte

  // Reset the frame index to 0 so the new sequence plays from its first frame. This is the
  // RESTART — a fresh look begins at frame 0, not wherever the previous one left off.
  mem8[base + 0x0e] = 0x00; // frame index -> 0
}
