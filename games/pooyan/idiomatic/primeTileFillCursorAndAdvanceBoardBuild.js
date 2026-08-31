// SPDX-License-Identifier: GPL-3.0-only
import { zeroSpriteListAndActorArena } from "./zeroSpriteListAndActorArena.js";
import {
  loc_8819,
  WATCHDOG_KICK,
  GAME_ACTIVE_FLAG,
  TILE_FILL_PTR,
  PLAYFIELD_PAINT_START,
  FILL_ROW_COUNTER,
  PLAY_STATE_INDEX,
} from "./names.js";
/**
 * primeTileFillCursorAndAdvanceBoardBuild — board-build sub-state 0.
 *
 * WHAT IT IS
 *   ROM 0x0c5c. When the top-level game selector MAIN_GAME_STATE (0x8805) sits at 2, each frame's
 *   beat runs the board-build sub-state machine, which walks a small index and runs exactly one
 *   handler per beat. This is the handler for index 0 — the very first setup pass of building a
 *   board, run once before any board graphics are laid down.
 *
 * ROLE IN THE MACHINE
 *   A board is not assembled in a single burst; it is spread across several frames, one setup
 *   handler per beat, so a big screen paint never happens all at once. Sub-state 0 does the one-time
 *   priming: it parks a write cursor at the top-left of the region that will be erased, loads a row
 *   budget, hands the machine on to sub-state 1, and blanks the RAM arenas a fresh board needs
 *   empty. The actual erasing of the tile plane is NOT done here — it is metered out one pair of
 *   short rows at a time by sub-state 1 (fillIntroRowsThenBuildBoardIntro), which drains
 *   FILL_ROW_COUNTER and, on the final row, fires the full board-intro build (checksum guard,
 *   attribute flood, credit/display commands).
 *
 * GROUNDING: [seen].
 *
 * LIVE-OUT (memory only):
 *   - loc_8819 (0x8819)          cleared to 0
 *   - GAME_ACTIVE_FLAG (0x8806)  cleared to 0 — the machine is between rounds, not in live play
 *   - TILE_FILL_PTR (0x880b)     = PLAYFIELD_PAINT_START (0x8442), the wipe cursor's origin cell
 *   - FILL_ROW_COUNTER (0x8809)  = 0x0f, the number of fill rows sub-state 1 will meter out
 *   - PLAY_STATE_INDEX (0x880a)  bumped 0 -> 1, so the next beat runs the fill handler
 *   - the sprite display list and the actor/object arena are zeroed (via the delegated clear)
 *   plus the hardware watchdog is petted along the way.
 */
export function primeTileFillCursorAndAdvanceBoardBuild(m) {
  const { mem8, mem16 } = m;

  // Clear the scratch byte at 0x8819. The same cell is zeroed on entry to attract sub-state 0 and to
  // play state 0; its precise purpose is unconfirmed, so it keeps a positional name. [seen]
  mem8[loc_8819] = 0x00;

  // Pet the hardware watchdog. Writing the watchdog address (0xa028 — a mirror on the write side of
  // the 0xa000 watchdog device) resets the countdown that would otherwise reset the board; the value
  // written is ignored, only the act of writing counts. Board build can span enough frames that a
  // kick here keeps the guard from firing mid-setup. [code]
  mem8[WATCHDOG_KICK] = 0x00; // watchdog kick

  // Drop the in-play gate. GAME_ACTIVE_FLAG (0x8806) is the flag every gameplay handler tests to
  // decide whether a round is live; clearing it marks the machine as between rounds while the board
  // is assembled, so per-frame gameplay logic stays dormant. [seen]
  mem8[GAME_ACTIVE_FLAG] = 0x00;

  // Seat the tile-fill write cursor at the top of the paint region. TILE_FILL_PTR (0x880b) is the
  // 16-bit video-RAM address the fill beat writes through; PLAYFIELD_PAINT_START (0x8442) is the
  // first cell of the blank-tile sweep. The fill beat advances this cursor by one row (+0x20) each
  // pass as it erases. [seen]
  mem16[TILE_FILL_PTR] = PLAYFIELD_PAINT_START;

  // Load the row budget. FILL_ROW_COUNTER (0x8809) is the down-counter that gates the fill: sub-state
  // 1 decrements it each pass and keeps erasing until it drains, at which point the board-intro build
  // fires exactly once. The board-build entry primes the shorter 0x0f-row run. [seen]
  mem8[FILL_ROW_COUNTER] = 0x0f;

  // Advance the board-build sub-state. PLAY_STATE_INDEX (0x880a) is the index the board-build
  // dispatcher reads to pick this frame's handler; bumping it 0 -> 1 means the next beat runs the
  // fill / board-intro handler instead of re-priming. [seen]
  mem8[PLAY_STATE_INDEX]++; // sub-state -> 1

  // Clear the board-init RAM regions: zero the sprite display list and the actor/object arena (ROM
  // 0x02b9) so the new board starts with no leftover sprites or actors from the previous one. [seen]
  zeroSpriteListAndActorArena(m); // clear the board-init RAM regions
}
