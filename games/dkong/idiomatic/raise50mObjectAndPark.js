// SPDX-License-Identifier: GPL-3.0-only
/**
 * raise50mObjectAndPark — one idle-then-retract tick for a 50m board object, parking it when it
 * reaches the TOP of its travel.
 *
 * One arm of the 50m object state machine, entered with a pointer to the object's own eight-byte
 * record — one of the two the dispatcher selects between by frame parity. The record base
 * arrives on the stack in the original; here it is an honest parameter.
 *
 * VERTICAL CONVENTION. The record's position counter is a SCREEN Y: it is published straight
 * into a sprite record's Y byte, and LARGER Y IS LOWER ON SCREEN. So the counter's minimum is
 * the object's HIGHEST point on screen and its maximum is its lowest, and stepping the counter
 * DOWN — which is what this arm does — moves the object UP.
 *
 * Field +4 is a per-tick countdown: it is stepped down every time this arm runs, and until it
 * underflows to zero the object simply idles for this tick. On the tick it underflows, the
 * countdown is reloaded and the position counter (field +3) is stepped DOWN by one; that new
 * position is then mirrored into the object's on-screen sprite cell, one of two slots chosen
 * from the record pointer. When the position reaches the top of its travel the object is parked:
 * field +1 takes a fixed value and the state byte (field +0) is cleared, sending the object back
 * to state 0 of the machine. The mirror-image arm is its opposite — it steps the same counter UP
 * toward the bottom and advances the state.
 *
 * Across the four states the full cycle is: parked at the top, extend DOWN, dwell at the bottom,
 * retract back UP, park. That is the motion of a retracting ladder — but the object has not been
 * identified against pixels, so the names deliberately say "object" and claim no identity.
 *
 * Every field address is taken within the record's own memory page, because the original pointer
 * walk steps only the low byte, so a field access never crosses a page boundary.
 *
 * LIVE-OUT: memory-only — the countdown, the position counter, the mirrored sprite cell, and on
 * the park the two reset bytes. The cascade that reaches this arm reads nothing back.
 */

import { publish50mObjectYToSprite } from "./publish50mObjectYToSprite.js";

/**
 * @param {object} m          the machine (uses m.mem only).
 * @param {number} recordBase base pointer of the object's record — one of the two records the
 *                            50m object state machine owns.
 * @returns {void}
 */
export function raise50mObjectAndPark(m, recordBase) {
  const { mem } = m;

  // Address of record field N, kept on the record's own page (the pointer walk steps only
  // the low byte, so a field address never crosses a page boundary).
  const field = (n) => (recordBase & 0xff00) | ((recordBase + n) & 0xff);

  // Field +4 — per-tick countdown. Step it down every tick; idle until it underflows.
  const countdown = (mem.read8(field(4)) - 1) & 0xff;
  mem.write8(field(4), countdown);
  if (countdown !== 0) return;

  // Underflowed: reload the countdown and step the position counter (+3) DOWN by one.
  mem.write8(field(4), 0x02);
  const position = (mem.read8(field(3)) - 1) & 0xff;
  mem.write8(field(3), position);

  // Mirror the new position into this object's on-screen sprite position cell.
  publish50mObjectYToSprite(m, field(3));

  // Still retracting upward — stop until the counter reaches its minimum (the top of travel).
  if (position !== 0x68) return;

  // Top of travel reached: reset the object — field +1 to 0x80, then the state byte (+0) to 0,
  // returning it to state 0 of the object state machine.
  mem.write8(field(1), 0x80);
  mem.write8(field(0), 0x00);
}
