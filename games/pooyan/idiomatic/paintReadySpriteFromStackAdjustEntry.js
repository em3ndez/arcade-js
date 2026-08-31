// SPDX-License-Identifier: GPL-3.0-only
import { paintReadySpriteSquareIfAbsent } from "./paintReadySpriteSquareIfAbsent.js";
/**
 * paintReadySpriteFromStackAdjustEntry — a stack-adjust entry that falls straight into the ready-sprite painter.
 *
 * Reached by a jump that lands one byte early, its only machine act is to discard a byte of
 * the pushed return before continuing into the painter. That discard is a stack/return
 * effect the memory model drops, so the memory behaviour here is exactly the painter's:
 * stamp the ready-sprite square unless it is already present.
 *
 * LIVE-OUT: none — memory only (the painter's video cells).
 */

export function paintReadySpriteFromStackAdjustEntry(m) {
  return paintReadySpriteSquareIfAbsent(m);
}
