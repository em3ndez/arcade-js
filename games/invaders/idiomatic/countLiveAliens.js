// SPDX-License-Identifier: GPL-3.0-only
import { ALIEN_COUNT, LAST_ALIEN_FLAG } from "./names.js";
import { activePlayerPageBase } from "./activePlayerPageBase.js";

/**
 * countLiveAliens — census the active player's alien field and publish the survivor count.
 *
 * WHAT IT IS
 *   Once per pass it scans the 55-cell (0x37) liveness grid of whichever player is currently on the
 *   machine, counts the cells that are still nonzero (each nonzero byte is one alien still on the board),
 *   writes that running total to ALIEN_COUNT, and — as a special case — raises LAST_ALIEN_FLAG when
 *   exactly one alien remains, singling out the lone survivor.
 *
 * ROLE IN THE MACHINE
 *   Each player owns a 256-byte work-RAM page (player 1 at 0x2100, player 2 at 0x2200); the low 0x37
 *   bytes are the liveness grid, five rows of eleven (see mechanisms.md, "The alien field and its
 *   march"). activePlayerPageBase (ROM 0x1611) forms the base of the active page from the page byte
 *   ACTIVE_PLAYER_PAGE (0x2067)<<8, so the same scan follows whichever player is live. The published
 *   ALIEN_COUNT (0x2082) is what the rest of the machine reads to decide how fast the fleet should feel —
 *   the fleet-march sound steps its tempo from it, and the main loop uses count==0 to end the wave.
 *   LAST_ALIEN_FLAG (0x206b) marks the single-survivor case; no consumer for it is identified in the code.
 *   Called from the in-game main loop (mainLoop) each pass.
 *
 * ROM 0x15f3-0x1610.  Grounding: [seen] (names.js cert).
 *
 * LIVE-OUT: ALIEN_COUNT and (at exactly one survivor) LAST_ALIEN_FLAG written to work RAM.
 */
export function countLiveAliens(m) {
  // Resolve the base of the active player's page (page byte << 8); the grid begins at offset 0.
  const base = activePlayerPageBase(m);

  // Walk all 0x37 (55) grid cells; a byte reads nonzero for as long as that alien is still alive.
  let count = 0;
  for (let i = 0; i < 0x37; i++) {
    if (m.mem8[base + i] !== 0) count++;
  }

  // Publish the survivor tally — the machine's single source of truth for how thin the fleet is.
  m.mem8[ALIEN_COUNT] = count;

  // Exactly one alien left: raise the lone-survivor flag (set-only; no reader identified in the code).
  if (count === 1) m.mem8[LAST_ALIEN_FLAG] = 0x01;
}
