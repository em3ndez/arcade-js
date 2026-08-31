// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { paintReadySpriteFromStackAdjustEntry } from "./paintReadySpriteFromStackAdjustEntry.js";
import { scanFormationSlotsAndLaunchFree } from "./scanFormationSlotsAndLaunchFree.js";
import { runSpawnTickAndHunterSweep } from "./runSpawnTickAndHunterSweep.js";
import {
  RESET_ATTR_COLUMN,
  HUD_INTEGRITY_STRIP_A,
  RESET_SCAN_LATCH,
  TWO_PLAYER_FLAG,
  ACTIVE_PLAYER,
} from "./names.js";
/**
 * checksumIntegrityStripAndDispatchSpawn — the guarded reset scan at the head of the spawn tick.
 *
 * WHAT IT IS
 *   ROM 0x2b59-0x2b8c. Grounding: [seen].
 *   An entry that (1) wipes a short vertical column of the playfield back to its blank
 *   base value, (2) runs a tamper tripwire over a fixed strip of screen memory, and (3) only if
 *   that tripwire holds, clears the reset latch and forks into one of three spawn continuations.
 *
 * ROLE IN THE MACHINE
 *   This is a defended gateway into the enemy-spawn machinery. Pooyan's program image is shot
 *   through with small integrity checks; this one folds a ten-cell column of the on-screen field
 *   into a rolling sum and demands it equal a fixed magic total (0xaa) before letting the reset
 *   and the downstream spawn work proceed. If the strip has been altered, the whole routine backs
 *   out silently, leaving the spawn machinery untouched — a game whose screen memory has been
 *   tampered with quietly stops advancing rather than trapping loudly here. When the strip is
 *   intact the routine disarms the reset latch and dispatches the frame's spawn work along one of
 *   three arms chosen purely by the player-count / active-player flags.
 *
 * LIVE-OUT: none — memory only. Every arm either returns void or tail-delegates to another
 *   routine; this routine leaves behind only the blanked column, the possibly-cleared reset latch,
 *   and whatever the delegate writes.
 */
// Loop-count and layout constants. The two sweeps below both march UP the screen: each screen row
// sits ROW_STRIDE (0x20) cells before the one below it in memory, so stepping to the row above is a
// subtraction of 0x20 (address arithmetic wrapped to 16 bits by u16).
const COLUMN_ROWS = 0x08; // attribute cells blanked by the first sweep, one tile-row apart
const STRIP_BYTES = 0x0a; // cells folded into the integrity sum by the second sweep
const ROW_STRIDE = 0x20; // tile-grid row pitch; both sweeps subtract it to climb one row up
const BLANK_ATTR = 0x10; // base/blank attribute value written into each cleared column cell
const MAGIC_SUM = 0xaa; // the sum the integrity strip must total; any other value aborts the reset
const SCAN_STRIDE = -0x20; // upward stride handed to the formation-spawn scan (see that arm below)

export function checksumIntegrityStripAndDispatchSpawn(m) {
  const { mem8 } = m;

  // --- Step 1: blank the reset column ------------------------------------------------------------
  // Wipe an eight-tall column of the playfield back to the blank base attribute (0x10), starting at
  // RESET_ATTR_COLUMN (0x855f) and climbing one screen row per pass (address -= 0x20). This stages
  // a clean patch of field ahead of the board build / spawn work that the dispatch arms drive.
  let cell = RESET_ATTR_COLUMN;
  for (let i = 0; i < COLUMN_ROWS; i++) {
    mem8[cell] = BLANK_ATTR;
    cell = u16(cell - ROW_STRIDE);
  }

  // --- Step 2: the integrity tripwire ------------------------------------------------------------
  // Fold a ten-cell column of screen memory, starting at HUD_INTEGRITY_STRIP_A (0x82bc) and again
  // climbing one row per pass, into a single 8-bit rolling sum (wrapped to a byte each add). The
  // shipped field makes this sum come out to exactly MAGIC_SUM (0xaa); any other total means the
  // strip has been altered.
  let sum = 0;
  let src = HUD_INTEGRITY_STRIP_A;
  for (let i = 0; i < STRIP_BYTES; i++) {
    sum = (sum + mem8[src]) & 0xff;
    src = u16(src - ROW_STRIDE);
  }
  if (sum !== MAGIC_SUM) return; // checksum mismatch -> leave the reset latch and spawn work untouched

  // --- Step 3: disarm the reset latch ------------------------------------------------------------
  // The strip's sum matched. Clear the reset-scan latch (0x8e2a) so the reset it guards is consumed.
  mem8[RESET_SCAN_LATCH] = 0x00;

  // --- Step 4: dispatch the spawn continuation ---------------------------------------------------
  // Fork the frame's spawn work on the player-count / active-player flags. All three arms are tail
  // hand-offs; nothing further runs here.
  if (mem8[TWO_PLAYER_FLAG] === 0) return paintReadySpriteFromStackAdjustEntry(m); // one-player game -> ready-sprite painter
  // Two-player game with player 2 currently idle (ACTIVE_PLAYER 0x880d == 0) -> the formation-spawn
  // scan. Hand it the upward stride (-0x20) the two sweeps above just walked, so it steps the field
  // the same direction; the record-base argument is left at its default.
  if (mem8[ACTIVE_PLAYER] === 0) return scanFormationSlotsAndLaunchFree(m, undefined, SCAN_STRIDE);
  return runSpawnTickAndHunterSweep(m); // otherwise -> the shared spawn/hunter epilogue
}
