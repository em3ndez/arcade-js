// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearPlayerOneHomeBayGates  —  ROM 0x0534  ·  grounding: [seen,poked]
 *
 * WHAT IT IS
 *   The player-1-only cold board re-init. Its job is narrow: erase player 1's home-bay bookkeeping so his
 *   next board starts with all five home bays empty and his home tally back at zero — WITHOUT disturbing
 *   player 2's board, which is already seeded and must survive. It writes six bytes, then tail-calls
 *   straight into the shared cold-start finish, skipping the stage that would clear player 2.
 *
 * WHERE IT SITS  —  a shortcut into the cold-start fall-through chain
 *   A fresh game clears work RAM in three stages, each landing in the next (in the ROM by running off the
 *   end of one routine's code into the next; here by a plain tail-call):
 *     (1) coldStartClearSlotGates        — player-1 slot byte + the five PRIMARY-bank gates   (ROM 0x0547)
 *     (2) coldStartClearAltSlotGates     — player-2 slot byte + the five ALTERNATE-bank gates (ROM 0x0557)
 *     (3) coldStartClearPlayRamAndSetMode — the shared mid-entry that finishes init (screen, flags, mode)
 *   THIS routine is a fourth entry point. It does the exact same six writes as stage (1), but then jumps
 *   directly to stage (3) — deliberately bypassing stage (2). That skip is the whole point: player 2's
 *   slot byte and alternate-bank gates are left untouched, so his in-progress board is preserved.
 *
 *   It is reached from the intro / game-over handler runIntroTimerThenInitGame (ROM 0x048f), on the
 *   two-player continue path, when player 2's board is already active — i.e. CONTINUE_FLAG_2P (0x83ca) is
 *   set. In that situation player 1 needs a clean board but player 2's must be kept, so the full
 *   cold-start chain (which clears both) is wrong; this player-1-only re-init is taken instead.
 *
 * WHY THESE CELLS
 *   Frogger's board finishes at five home bays across the top row. Each bay's won/empty state lives in a
 *   one-byte "occupancy gate": nonzero = filled, zero = open. Every routine that stamps a creature or a
 *   landed frog into a bay first tests that bay's gate and skips the write when it is nonzero — so a bay
 *   counts as "open" precisely when its gate reads zero. Zeroing the five gates therefore re-opens all
 *   five bays for player 1's new board. Alongside the gates, a per-player scalar (the "slot byte") counts
 *   how many bays are filled; the board-complete check reads it for the value 5. Zeroing it resets the
 *   count. Both cells are the PRIMARY-bank set — player 1's own — as opposed to the alternate bank that
 *   holds player 2's identical pair of structures.
 *
 * LIVE-OUT
 *   Memory only — six byte writes (the slot byte plus five gates). Returns whatever the shared mid-entry
 *   returns (itself memory-only), which the caller ignores; it leaves no register the caller reads.
 */
import { PLAYER1_SLOT, HOME_BAY1_OCCUPANCY_PRIMARY } from "./names.js";
import { coldStartClearPlayRamAndSetMode } from "./coldStartClearPlayRamAndSetMode.js";

// The board has exactly five home bays, so their occupancy gates form five contiguous cells:
// HOME_BAY1_OCCUPANCY_PRIMARY (0x825e) through HOME_BAY5_OCCUPANCY_PRIMARY (0x8262).
const HOME_BAY_COUNT = 5;

export function clearPlayerOneHomeBayGates(m) {
  const { mem8 } = m;

  // ── Reset player 1's home tally ──────────────────────────────────────────────────────
  // PLAYER1_SLOT (0x825c) counts how many of the five bays player 1 has filled (0..5). The
  // board-completion check fires when this reaches 5, so player 1's re-init must start it at zero.
  mem8[PLAYER1_SLOT] = 0;

  // ── Re-open all five primary-bank home bays ──────────────────────────────────────────
  // Clear the five contiguous occupancy gates HOME_BAY1_OCCUPANCY_PRIMARY (0x825e) .. 0x8262. This is
  // player 1's own bank — the one read when ACTIVE_PLAYER (0x83fd) holds 1. A gate reads nonzero once
  // its bay is filled, and the bay stampers skip a nonzero gate, so writing 0 marks every bay empty and
  // open again. (The five addresses never cross a 256-byte boundary, so no 16-bit-wrap guard is needed.)
  for (let i = 0; i < HOME_BAY_COUNT; i++) mem8[HOME_BAY1_OCCUPANCY_PRIMARY + i] = 0;

  // ── Skip straight to the shared cold-start finish ────────────────────────────────────
  // Player 1's bookkeeping is now clear. Jump directly to coldStartClearPlayRamAndSetMode (ROM 0x0567) —
  // NOT to the player-2 clear at stage (2). That routine reads the gates we just zeroed and finishes the
  // init (clears the screen, runs the credit/score-rank/header setup, wipes the work-RAM spans, zeros the
  // game-state flags, sets GAME_MODE). By entering here rather than at stage (1), player 2's slot byte and
  // alternate-bank gates are never touched, so his board survives player 1's re-init. A plain tail-call
  // reproduces the ROM's direct jump into that shared entry.
  return coldStartClearPlayRamAndSetMode(m);
}
