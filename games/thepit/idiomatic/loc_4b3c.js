// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_4b3c — stow the 0xC0 board-mode byte, then run the shared display-setup body.  ROM 0x4b3c.
 *
 * The 0xC0 door of a three-way setup fan-in: three sibling entries each pick a
 * different board-mode / entry-select byte (this one 0xC0, the others 0x90 and
 * 0x00) and hand it to one shared setup body. That body stows the byte at
 * BOARD_MODE and then rebuilds the screen — clears sprite/attribute RAM, repaints
 * the whole tilemap, flat-fills colour RAM (using this very byte as the screen-wide
 * colour), and wipes a work block. So the byte is both a mode selector that later
 * code reads and, in this immediate setup, the colour every cell is painted.
 *
 * The setup body (setupBoardDisplay, ROM 0x4b46) takes the byte as its boardMode
 * parameter, so this door just passes 0xC0 in directly. The body's own return
 * unwinds to this routine's caller, so the hand-off IS the exit and is returned
 * straight through. Reads nothing on entry (the byte is hardwired), so it always
 * drives the same 0xC0 setup.
 *
 * Name kept neutral: the action — pick the 0xC0 variant and run the shared setup —
 * is clear, but which game situation the 0xC0 variant corresponds to (versus its
 * 0x90 / 0x00 siblings) is not confirmed to the naming bar, so it earns no specific
 * English name yet.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4b3c.test.js.
 * GATE:     real dispatch — fires once during boot (called from the cold-boot init).
 *           Straight-line (set the byte, tail-hand to the shared body), so that one
 *           entry covers the whole path. Teeth: a twin that stows the wrong board-mode
 *           byte is caught at BOARD_MODE and in the colour RAM it flat-fills.
 * LIVE-OUT: memory-only — BOARD_MODE (0x8057) set to the selector byte, plus every
 *           byte the shared body writes (cleared sprite/attribute RAM, the repainted
 *           tilemap and colour RAM, the wiped work block); SP/pc land where its return
 *           goes. No register or flag is live out — the shared body's residual
 *           byte/flags are dead scratch the body and callers reload before reading.
 * NAMES:    BOARD_MODE (0x8057) from ram.js — the byte this door stows and the setup
 *           consumes as the colour fill. The 0xC0 selector stays hex: it is a
 *           colour / attribute byte, so its bit layout is the point.
 */
import { setupBoardDisplay } from "./setupBoardDisplay.js";

export function loc_4b3c(m) {
  // Pick the 0xC0 variant and run the shared setup: it stows the byte at BOARD_MODE
  // and reuses it as the screen-wide colour-RAM fill, then clears sprite/attribute
  // RAM, repaints the tilemap and colour RAM, and wipes a work block. Siblings pick
  // 0x90 and 0x00. Its return unwinds to our caller, so this tail hand-off is the
  // exit — return it straight through.
  return setupBoardDisplay(m, 0xc0);
}
