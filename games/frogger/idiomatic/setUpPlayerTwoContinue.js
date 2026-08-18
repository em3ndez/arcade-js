// SPDX-License-Identifier: GPL-3.0-only
/**
 * setUpPlayerTwoContinue  —  ROM 0x04f3  ·  grounding: [code] (MAME-grounding pending)
 *
 * WHAT IT IS
 *   The player-2 setup arm of the intro / game-over entry. When a two-player game reaches the point of
 *   (re)starting player 2's turn, this routine either re-enters the cold-start init chain or seeds a live
 *   player-2 board: it clears the screen, flips the active player, raises the in-play flags, wipes
 *   player 2's home-bay occupancy gates, and restores player 2's saved object and work pages into the
 *   live pages so the board comes back exactly as that player left it.
 *
 * WHERE IT SITS
 *   The mirror image of runIntroTimerThenInitGame's own player-1 branch. runIntroTimerThenInitGame
 *   (ROM 0x048f) dispatches here when the turn belongs to player 2. The two routines cooperate through a
 *   pair of one-shot flags: this one sets CONTINUE_FLAG_2P (0x83ca) and reads CONTINUE_FLAG (0x83c9),
 *   while runIntroTimerThenInitGame sets CONTINUE_FLAG and reads CONTINUE_FLAG_2P — each marking that its
 *   own side has been through setup, so the other side can tell whether a fresh board seed is still owed.
 *   Like the other top-level dispatchers (cold start, board setup, next-life) it ends by tail-returning
 *   into the foreground main loop at its pace-tail re-entry.
 *
 * LIVE-OUT
 *   Memory only. It writes the two continue/play flags, the player-2 slot, five occupancy gates, the
 *   attribute shadow, and the two restored RAM pages, then tail-calls onward. It returns nothing the
 *   caller reads.
 */
import {
  PLAY_FLAG, LIVE_OBJECT_PAGE, LANE_OBJECT_INDEX, OBJRAM_COL3F_ATTR_SHADOW,
  HOME_BAY1_OCCUPANCY_ALT, OBJECT_PAGE_SAVE_BANK, WORK_PAGE_SAVE_BANK,
  PLAYER2_SLOT,
  CONTINUE_FLAG, CONTINUE_FLAG_2P,
} from "./names.js";
import { endForegroundPassAtPaceTail } from "./endForegroundPassAtPaceTail.js";
import { coldStartClearAltSlotGates } from "./coldStartClearAltSlotGates.js";
import { clearTilemapToTile16 } from "./clearTilemapToTile16.js";
import { handOffToOtherPlayer } from "./handOffToOtherPlayer.js";

// The per-player WORK page: 0xb7 = 183 bytes. This is the same span that swapIn/swapOutActivePlayerPages
// bank between the live base LANE_OBJECT_INDEX (0x80ff) and the save bank WORK_PAGE_SAVE_BANK (0x8500) —
// the lane-object walk state and the rest of player 2's per-turn work RAM.
const WORK_PAGE_LEN = 0xb7;

// The per-player OBJECT page: 0x2b = 43 bytes of lead-sprite/object records, banked between the live base
// LIVE_OBJECT_PAGE (0x800c) and the save bank OBJECT_PAGE_SAVE_BANK (0x86c0).
const OBJECT_PAGE_LEN = 0x2b;

// Frogger has five home bays across the top of the river. Their player-2 (alternate-bank) occupancy gates
// occupy five consecutive cells HOME_BAY1_OCCUPANCY_ALT (0x8263) .. 0x8267.
const HOME_BAY_OCCUPANCY_GATE_COUNT = 5;

export function setUpPlayerTwoContinue(m) {
  const { mem8 } = m;

  // ── Mark player 2's side as set up ───────────────────────────────────────────────────
  // Raise CONTINUE_FLAG_2P (0x83ca), the player-2-path continue flag. runIntroTimerThenInitGame reads
  // this later to decide whether player 2's board still needs seeding, so it must be set before any of
  // the board work below (and before the early return).
  mem8[CONTINUE_FLAG_2P] = 1;

  // ── Already past player-1 setup? → re-enter the cold-start init chain ─────────────────
  // CONTINUE_FLAG (0x83c9) is the player-1-path flag, raised by runIntroTimerThenInitGame's own branch.
  // If it is already set there is no fresh player-2 board to seed here; instead tail into the cold-start
  // alternate-slot-gate clear (ROM 0x0557), which zeros PLAYER2_SLOT (0x825d) and the five alt occupancy
  // gates and then falls into the shared cold-start mid-entry. Plain tail-call: run it, return to caller.
  if (mem8[CONTINUE_FLAG] !== 0) return coldStartClearAltSlotGates(m);

  // ── Wipe the screen for the incoming board ───────────────────────────────────────────
  // Fill the whole tilemap with the blank tile 16 so player 2's board is drawn onto a clean field.
  clearTilemapToTile16(m);

  // ── Hand the turn to the other player ────────────────────────────────────────────────
  // Toggle ACTIVE_PLAYER between 1 and 2, load that player's life counter into LIVES_COUNT, and — on a
  // cocktail cabinet — physically flip the screen so player 2 sees the board right-side-up.
  handOffToOtherPlayer(m);

  // ── Raise the in-play flags ──────────────────────────────────────────────────────────
  // PLAY_FLAG (0x83fe) doubles as the in-play flag and the player count; the pace tail routes to the
  // in-play tree once it is non-zero. PLAYER2_SLOT (0x825d) is player 2's home tally; seed it to 1.
  mem8[PLAY_FLAG] = 1;
  mem8[PLAYER2_SLOT] = 1;

  // ── Clear player 2's home-bay occupancy gates ────────────────────────────────────────
  // Zero the five alternate-bank gates HOME_BAY1_OCCUPANCY_ALT (0x8263)..0x8267 so the fresh board starts
  // with every home bay marked empty (a non-zero gate means "this bay already filled").
  for (let i = 0; i < HOME_BAY_OCCUPANCY_GATE_COUNT; i++) mem8[HOME_BAY1_OCCUPANCY_ALT + i] = 0;

  // ── Restore player 2's saved object page into the live page ──────────────────────────
  // Copy the 43-byte object page out of its save bank OBJECT_PAGE_SAVE_BANK (0x86c0) into the live object
  // page LIVE_OBJECT_PAGE (0x800c), bringing back player 2's lead-sprite/object records.
  for (let i = 0; i < OBJECT_PAGE_LEN; i++) mem8[LIVE_OBJECT_PAGE + i] = mem8[OBJECT_PAGE_SAVE_BANK + i];

  // ── Set the OBJRAM per-column attribute shadow ───────────────────────────────────────
  // OBJRAM_COL3F_ATTR_SHADOW (0x803f) is the work-RAM shadow of the OBJRAM column-0x3f attribute byte
  // (DMA'd to 0xb03f each frame). Writing 1 sets that column's attribute for the restored board. (The ROM
  // writes it here, between the two page copies — order preserved.)
  mem8[OBJRAM_COL3F_ATTR_SHADOW] = 1;

  // ── Restore player 2's saved work page into the live page ────────────────────────────
  // Copy the 183-byte work page out of its save bank WORK_PAGE_SAVE_BANK (0x8500) into the live work page
  // LANE_OBJECT_INDEX (0x80ff), bringing back the lane-object walk state and the rest of the per-turn RAM.
  for (let i = 0; i < WORK_PAGE_LEN; i++) mem8[LANE_OBJECT_INDEX + i] = mem8[WORK_PAGE_SAVE_BANK + i];

  // ── Resume the foreground main loop ──────────────────────────────────────────────────
  // Tail-return into the pace-tail re-entry so the newly seeded board picks up on the next frame.
  return endForegroundPassAtPaceTail(m);
}
