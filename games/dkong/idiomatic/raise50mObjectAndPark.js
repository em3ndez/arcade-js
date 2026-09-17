// SPDX-License-Identifier: GPL-3.0-only
/**
 * raise50mObjectAndPark — one idle-then-retract tick for a 50m board object, parking it when it
 * reaches the top of its travel. recordBase points at the object's 8-byte record. Field +4 is a
 * per-tick countdown; on the tick it underflows it reloads and steps the position counter (+3)
 * DOWN by one (larger Y is lower on screen, so down moves the object UP), mirrors that into the
 * sprite cell, and at the top parks the object (+1 <- 0x80, state +0 <- 0).
 *
 * LIVE-OUT: memory-only — the countdown, the position counter, the mirrored sprite cell, and on
 * the park the two reset bytes.
 */

import { publish50mObjectYToSprite } from "./publish50mObjectYToSprite.js";

export function raise50mObjectAndPark(m, recordBase) {
  const { mem8 } = m;

  // Field N, kept on the record's own page (the pointer walk steps only the low byte).
  const field = (n) => (recordBase & 0xff00) | ((recordBase + n) & 0xff);

  const countdown = (mem8[field(4)] - 1) & 0xff;
  mem8[field(4)] = countdown;
  if (countdown !== 0) return;

  mem8[field(4)] = 0x02;
  const position = (mem8[field(3)] - 1) & 0xff;
  mem8[field(3)] = position;

  publish50mObjectYToSprite(m, field(3));

  // Still retracting upward — stop until the counter reaches the top of travel.
  if (position !== 0x68) return;

  mem8[field(1)] = 0x80;
  mem8[field(0)] = 0x00;
}
