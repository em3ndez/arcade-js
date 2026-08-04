// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2101 — offer an object to the bottom-of-screen retirement check, and go on to the left-edge
 * check only if the first one let the object live.
 *
 * There is no arithmetic here at all. What this routine carries is the CONTROL PROTOCOL between
 * two checks, and that protocol is its entire content.
 *
 * The bottom-of-screen check can take control away. On the arm where it retires the object, it
 * removes the continuation this routine set up for it and diverts into the shared object-sprite
 * tail — so control never comes back and the second check must NOT run. It reports that by
 * answering false, and obeying that answer is the one thing this routine has to get right. It is
 * also its only branch: on every other arm the check hands control back, and the object carries
 * on to the left-edge test.
 *
 * What the two checks look for: the first retires an object whose Y has reached the bottom of the
 * screen while its X sits inside a narrow band; the second retires one whose X has run off the
 * left edge. NOT CLAIMED: which game event puts an object in either position, or why both limits
 * are tested at this point rather than somewhere else.
 *
 * It reads and writes no memory of its own. The object's record stays in the index register
 * rather than arriving as a parameter, because both checks read it straight off the machine.
 *
 * LIVE-OUT: the answer it hands back, and nothing else — everything else in the machine at exit
 * was put there by the two checks.
 */

export function loc_2101(m) {
  // The continuation the bottom-of-screen check is given: where to resume if it lets the
  // object live.
  m.push16(0x2104);

  // A false answer means the object was retired: the check took that continuation back off
  // the stack itself and diverted into the shared object-sprite tail. Control has left.
  if (!m.call(0x24b4)) return undefined;

  // Still live: run the left-edge check and hand back whatever it resolves to.
  return m.call(0x2104);
}
