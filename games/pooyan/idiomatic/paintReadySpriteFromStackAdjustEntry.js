// SPDX-License-Identifier: GPL-3.0-only
import { paintReadySpriteSquareIfAbsent } from "./paintReadySpriteSquareIfAbsent.js";
/**
 * paintReadySpriteFromStackAdjustEntry — an alternate entry, one byte ahead of the ready-sprite
 * painter, whose sole instruction trims a byte off the caller's pending return before falling
 * straight into that painter.
 *
 * WHAT IT IS: a one-instruction landing pad at ROM 0x2bd2. That instruction is `inc sp`, which
 * nudges the stack pointer up by one and so discards the low byte of the return address the caller
 * left on the stack. Execution then continues with no branch into the ready-sprite painter that
 * begins at the very next byte, 0x2bd3 (paintReadySpriteSquareIfAbsent).
 * Grounding: [seen].
 *
 * ROLE IN THE MACHINE: the formation-reset dispatcher checksumIntegrityStripAndDispatchSpawn
 * (ROM 0x2b59), once its integrity strip sums to the magic total, hands off along the two-player /
 * active-player flags. When those flags select this arm it jumps here — to 0x2bd2, one byte early —
 * rather than to the painter at 0x2bd3. The extra `inc sp` is a return-path trick: discarding a byte
 * of the pending return address adjusts the return the machine will eventually take, without
 * changing anything the painter itself does. The adjustment touches only the stack pointer and the
 * pending return; it writes nothing to game data or video memory. So the lasting on-screen effect of
 * coming in here is exactly the painter's — stamp the ready-sprite 2x2 tile square into video RAM
 * unless it is already present.
 *
 * LIVE-OUT: none — memory only, and only the painter's four video cells.
 */

export function paintReadySpriteFromStackAdjustEntry(m) {
  // The `inc sp` at 0x2bd2 is a stack-only, return-path adjustment that leaves game and video memory
  // untouched, so in terms of what ends up on screen this entry is identical to entering the painter
  // directly. Continue straight into the ready-sprite painter at 0x2bd3 (paintReadySpriteSquareIfAbsent):
  // it peeks the square's anchor cell in video RAM (0x87bb) and, only if the marker is not already up,
  // stamps the fixed four-byte 2x2 tile block into that block of cells.
  return paintReadySpriteSquareIfAbsent(m);
}
