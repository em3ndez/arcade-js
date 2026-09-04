// SPDX-License-Identifier: GPL-3.0-only
import { blankScreenStrip } from "./blankScreenStrip.js";
import { loc_21fb, loc_22fb } from "./names.js";

/**
 * loc_00d7 (ROM 0x00d7) -- seed both players' fleet-step delta, then clear the one-player status strip.
 *
 * WHAT IT IS
 *   A game-start helper that writes 0x02 into the two per-player delta cells and then blanks a fixed screen
 *   strip (in one-player mode only). loc_21fb and loc_22fb are the per-player saved fleet-step delta bytes:
 *   they live at page-offset 0xfb of each player's alien page (player 1's page 0x21xx, player 2's 0x22xx),
 *   one byte below the reference-alien save record. loadReferenceAlienState reads this delta back per turn,
 *   so seeding both to 0x02 arms each fleet's initial horizontal step of two pixels.
 *
 * ROLE IN THE MACHINE
 *   Called once from the shared game-start init startGameFlow (between marking the aliens alive and seating
 *   the object records). Delegates the screen clear to blankScreenStrip, which itself early-outs in
 *   two-player mode (it reads the TWO_PLAYER_GAME guard) and otherwise clears a 0x20-column VRAM strip at
 *   loc_391c. (Keeps a loc_ name because its game-role label is not yet settled; mechanism is [seen].)
 *
 * ROM 0x00d7.  Grounding: [seen] (names.js cert for 0x00d7).
 *
 * LIVE-OUT: HL (inherited from blankScreenStrip / clearScreenStrip).
 */
// Seed the mirrored per-player cells to 2, then blank the fixed screen strip unless its guard is set.
export function loc_00d7(m) {
  // Arm both players' initial fleet-step delta to 0x02 (two pixels); loadReferenceAlienState reads it back.
  m.mem8[loc_21fb] = 0x02;
  m.mem8[loc_22fb] = 0x02;
  // Blank the fixed status strip -- a no-op in two-player mode, where blankScreenStrip's guard returns early.
  return blankScreenStrip(m);
}
