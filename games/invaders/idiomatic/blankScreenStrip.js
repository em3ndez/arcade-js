// SPDX-License-Identifier: GPL-3.0-only
import { clearScreenStrip } from "./clearScreenStrip.js";
import { TWO_PLAYER_GAME, loc_391c } from "./names.js";

/**
 * blankScreenStrip — blank one fixed screen strip, but only in one-player mode.
 *
 * WHAT IT IS
 *   Zeroes a fixed 0x20-column run of the framebuffer anchored at loc_391c — unless the game is in
 *   two-player mode, in which case it returns without touching the screen.
 *
 * ROLE IN THE MACHINE
 *   TWO_PLAYER_GAME (0x20ce) is the mode-guard cell: nonzero means a two-player game is running
 *   (see mechanisms.md "Frame tasks, timers, boot, and scoring"). Some heads-up furniture that must
 *   be cleared in a one-player layout is left in place for two players, so this routine gates the
 *   clear on that cell. When it does clear, it hands the actual work to clearScreenStrip, which
 *   fills a run of screen columns (0x20 of them here) with zero starting at the given address. The
 *   strip origin loc_391c is a specific framebuffer address whose exact purpose is not yet
 *   recovered, so it keeps its placeholder name. Reached from loc_00d7, which blanks this strip as
 *   part of its per-player screen setup.
 *
 * ROM 0x08e4.  Grounding: [seen].
 *
 * LIVE-OUT: on the clearing path, HL is left where clearScreenStrip parks it (one stride past the
 * blanked run); on the early-return path nothing is disturbed.
 */
export function blankScreenStrip(m) {
  // Mode guard: if a two-player game is active (TWO_PLAYER_GAME nonzero) leave the strip alone —
  // this mirrors the Z80 rnz early-out that skips the clear when the cell is set.
  if (m.mem8[TWO_PLAYER_GAME] !== 0) return;
  // One-player mode: blank a 0x20-column strip starting at loc_391c via the shared strip clearer.
  return clearScreenStrip(m, 0x20, loc_391c);
}
