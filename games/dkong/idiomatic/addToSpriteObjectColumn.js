// SPDX-License-Identifier: GPL-3.0-only
/**
 * addToSpriteObjectColumn — add one signed delta into the SAME field of all ten sprite-object
 * records at once, shifting a whole column of them together.
 *
 * A two-line shim in front of the general strided add. It fixes the two numbers that make the
 * general primitive specific to the sprite-object block — a stride of 4, which is one record, and
 * a count of 10, which is how many records the block holds — and then runs the shared loop. Both
 * numbers are hard-wired here and NOT read from the caller.
 *
 * The caller supplies which field to hit and the delta to add. Pointing at the first byte of the
 * block moves the X of every record; pointing three bytes in moves the Y. The delta is signed, so
 * a small negative value nudges the whole group left or up and a positive one shifts it across.
 * The effect on screen is a row of scenery or a staged figure repositioned by one number, which
 * is what board and cutscene setup use it for.
 *
 * The add is 8-bit and wraps, and the field within each record is the only thing it touches.
 *
 * LIVE-OUT: the ten bytes, each raised by the delta — plus the stride itself, which is a genuine
 * output: one caller invokes this for the stride and leaves the add as a side effect.
 */
import { addStrided } from "./addStrided.js";

export function addToSpriteObjectColumn(m) {
  const { regs } = m;
  regs.de = 0x0004; // one sprite-object record: the gap between successive targets
  regs.b = 0x0a; // ten records in the block

  // The shared strided add: the caller's delta into each of those ten bytes. The caller's
  // pointer and delta pass through, and the stride comes back unchanged.
  addStrided(m);
}
