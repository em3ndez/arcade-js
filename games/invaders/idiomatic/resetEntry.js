// SPDX-License-Identifier: GPL-3.0-only
import { bootInit } from "./bootInit.js";

/**
 * resetEntry — the CPU reset vector.
 *
 * WHAT IT IS
 *   The address the 8080 begins executing at power-on / reset (ROM 0x0000). It does no work itself; it
 *   immediately jumps to the boot-init routine, which brings the machine up.
 *
 * ROLE IN THE MACHINE
 *   Tail-hands to bootInit (0x18d4), which seeds work RAM (initWorkRam), paints the score panel
 *   (redrawScorePanel), and then enters the attract loop at enterAttractCycle (mechanisms.md, boot).
 *   Because the ROM reaches boot through a plain jump, this is not a generator — the attract-loop
 *   generator that the engine drives is produced downstream by the attract routines, not here.
 *
 * ROM 0x0000.  Grounding: [seen].
 *
 * LIVE-OUT: whatever bootInit returns (the boot / attract entry).
 */
export function resetEntry(m) {
  // Jump straight into boot init; everything after power-on happens there.
  return bootInit(m);
}
