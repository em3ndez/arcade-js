// SPDX-License-Identifier: GPL-3.0-only
/**
 * coldStartClearAltSlotGates  —  ROM 0x0557  ·  grounding: [code] (code-level; MAME-grounding pending)
 *
 * WHAT IT IS
 *   Part two of the three-stage RAM wipe that boots a fresh Frogger game. It is the exact mirror of part
 *   one (coldStartClearSlotGates), but for player 2: it erases player 2's home-bay bookkeeping so the new
 *   board starts with all five home bays empty and player 2's home tally back at zero. It writes six
 *   bytes, then falls straight through into part three.
 *
 * WHERE IT SITS  —  the cold-start fall-through chain
 *   A new game clears work RAM in three parts, each landing in the next (in the ROM by running off the
 *   end of one routine's code into the next; here by a plain tail-call):
 *     (1) coldStartClearSlotGates        — player-1 slot byte + the five PRIMARY-bank gates (ROM 0x0547)
 *     (2) coldStartClearAltSlotGates     — THIS routine: player-2 slot byte + the five ALTERNATE-bank gates
 *     (3) coldStartClearPlayRamAndSetMode — the shared mid-entry that finishes init (screen, flags, mode;
 *                                           ROM 0x0567)
 *   A one-player fresh game arrives here by falling through part one. In addition, this stage is a direct
 *   entry point for the TWO-PLAYER CONTINUE path: setUpPlayerTwoContinue (ROM 0x04f3) jumps straight here
 *   once the first continue flag CONTINUE_FLAG (0x83c9) is already set. That is why player 2's clear lives
 *   in its own routine — it has a caller that needs to run it without redoing player 1's clear.
 *
 * WHY THESE CELLS
 *   Frogger's board finishes at five home bays across the top row. Each bay's won/empty state lives in a
 *   one-byte "occupancy gate": nonzero = filled, zero = open. Every routine that stamps a creature or a
 *   landed frog into a bay first tests that bay's gate and skips the write when it is nonzero — so a bay
 *   counts as "open" precisely when its gate reads zero. Zeroing the five gates therefore re-opens all
 *   five bays for the new board. The gates come in two parallel five-cell banks, one per player, selected
 *   by ACTIVE_PLAYER (0x83fd): the primary bank when it holds 1, the ALTERNATE bank otherwise — so each
 *   player carries an independent set of five bay flags. This routine owns the alternate (player-2) bank.
 *   Alongside the gates, a per-player scalar (the "slot byte") counts how many bays are filled; the
 *   board-complete check reads it for the value 5. Zeroing it resets player 2's count.
 *
 * LIVE-OUT
 *   Memory only — six byte writes (the player-2 slot byte plus its five gates). Returns whatever part
 *   three returns (itself memory-only), which the caller ignores; it leaves no register the caller reads.
 */
import { PLAYER2_SLOT, HOME_BAY1_OCCUPANCY_ALT } from "./names.js";
import { coldStartClearPlayRamAndSetMode } from "./coldStartClearPlayRamAndSetMode.js";

// The board has exactly five home bays, so their occupancy gates form five contiguous cells:
// HOME_BAY1_OCCUPANCY_ALT (0x8263) through HOME_BAY5_OCCUPANCY_ALT (0x8267).
const HOME_BAY_COUNT = 5;

export function coldStartClearAltSlotGates(m) {
  const { mem8 } = m;

  // ── Reset player 2's home tally ──────────────────────────────────────────────────────
  // PLAYER2_SLOT (0x825d) counts how many of the five bays player 2 has filled (0..5). The
  // board-completion check fires when this reaches 5, so a fresh game must start it at zero. It sits one
  // byte above PLAYER1_SLOT (0x825c), which part one already cleared.
  mem8[PLAYER2_SLOT] = 0;

  // ── Re-open all five alternate-bank home bays ────────────────────────────────────────
  // Clear the five contiguous occupancy gates HOME_BAY1_OCCUPANCY_ALT (0x8263) .. 0x8267. This is
  // player 2's own bank — the one read when ACTIVE_PLAYER (0x83fd) does NOT hold 1. A gate reads nonzero
  // once its bay is filled, and the bay stampers skip a nonzero gate, so writing 0 marks every bay empty
  // and open again. (The five addresses never cross a 256-byte boundary, so no 16-bit-wrap guard is
  // needed — the raw index add stays within page 0x82xx.)
  for (let i = 0; i < HOME_BAY_COUNT; i++) mem8[HOME_BAY1_OCCUPANCY_ALT + i] = 0;

  // ── Fall through to part three ────────────────────────────────────────────────────────
  // Both players' home bookkeeping is now clear; hand off to the shared cold-start mid-entry
  // coldStartClearPlayRamAndSetMode (ROM 0x0567), which finishes the boot — clears the screen, wipes the
  // work-RAM spans, zeroes the game-state bytes, and sets GAME_MODE. A plain tail-call reproduces the
  // ROM's fall-through into the next routine.
  return coldStartClearPlayRamAndSetMode(m);
}
