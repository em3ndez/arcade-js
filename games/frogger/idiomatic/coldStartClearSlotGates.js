// SPDX-License-Identifier: GPL-3.0-only
/**
 * coldStartClearSlotGates  —  ROM 0x0547  ·  grounding: [code] (code-level; MAME-grounding pending)
 *
 * WHAT IT IS
 *   Part one of the three-stage RAM wipe that boots a fresh Frogger game. Its job is narrow: erase
 *   player 1's home-bay bookkeeping so the new board starts with all five home bays empty and player 1's
 *   home tally back at zero. It writes six bytes, then falls straight through into part two.
 *
 * WHERE IT SITS  —  the cold-start fall-through chain
 *   A new game clears work RAM in three parts, each landing in the next (in the ROM by running off the
 *   end of one routine's code into the next; here by a plain tail-call):
 *     (1) coldStartClearSlotGates        — THIS routine: player-1 slot byte + the five PRIMARY-bank gates
 *     (2) coldStartClearAltSlotGates     — player-2 slot byte + the five ALTERNATE-bank gates (ROM 0x0557)
 *     (3) coldStartClearPlayRamAndSetMode — the shared mid-entry that finishes init (screen, flags, mode)
 *   The one-player fresh-game path enters here at part one, from runIntroTimerThenInitGame (ROM 0x048f).
 *   (The player-2 continue path skips this stage and enters at part two, so player 1's tally survives on
 *   a continue. The player-1-only cold re-init clearPlayerOneHomeBayGates, ROM 0x0534, does the same six
 *   writes as this routine but then jumps straight to part three, leaving player 2's tally intact.)
 *
 * WHY THESE CELLS
 *   Frogger's board finishes at five home bays across the top row. Each bay's won/empty state lives in a
 *   one-byte "occupancy gate": nonzero = filled, zero = open. Every routine that stamps a creature or a
 *   landed frog into a bay first tests that bay's gate and skips the write when it is nonzero — so a bay
 *   counts as "open" precisely when its gate reads zero. Zeroing the five gates therefore re-opens all
 *   five bays for the new board. Alongside the gates, a per-player scalar (the "slot byte") counts how
 *   many bays are filled; the board-complete check reads it for the value 5. Zeroing it resets the count.
 *
 * LIVE-OUT
 *   Memory only — six byte writes (the slot byte plus five gates). Returns whatever part two returns
 *   (itself memory-only), which the caller ignores; it leaves no register the caller reads.
 */
import { PLAYER1_SLOT, HOME_BAY1_OCCUPANCY_PRIMARY } from "./names.js";
import { coldStartClearAltSlotGates } from "./coldStartClearAltSlotGates.js";

// The board has exactly five home bays, so their occupancy gates form five contiguous cells:
// HOME_BAY1_OCCUPANCY_PRIMARY (0x825e) through HOME_BAY5_OCCUPANCY_PRIMARY (0x8262).
const HOME_BAY_COUNT = 5;

export function coldStartClearSlotGates(m) {
  const { mem8 } = m;

  // ── Reset player 1's home tally ──────────────────────────────────────────────────────
  // PLAYER1_SLOT (0x825c) counts how many of the five bays player 1 has filled (0..5). The
  // board-completion check fires when this reaches 5, so a fresh game must start it at zero.
  mem8[PLAYER1_SLOT] = 0;

  // ── Re-open all five primary-bank home bays ──────────────────────────────────────────
  // Clear the five contiguous occupancy gates HOME_BAY1_OCCUPANCY_PRIMARY (0x825e) .. 0x8262. This is
  // player 1's own bank — the one read when ACTIVE_PLAYER (0x83fd) holds 1. A gate reads nonzero once
  // its bay is filled, and the bay stampers skip a nonzero gate, so writing 0 marks every bay empty and
  // open again. (The five addresses never cross a 256-byte boundary, so no 16-bit-wrap guard is needed.)
  for (let i = 0; i < HOME_BAY_COUNT; i++) mem8[HOME_BAY1_OCCUPANCY_PRIMARY + i] = 0;

  // ── Fall through to part two ──────────────────────────────────────────────────────────
  // Player 1's bookkeeping is now clear; hand off to coldStartClearAltSlotGates (ROM 0x0557), which does
  // the mirror-image clear of player 2's slot byte and alternate-bank gates before both reach the shared
  // cold-start mid-entry. A plain tail-call reproduces the ROM's fall-through into the next routine.
  return coldStartClearAltSlotGates(m);
}
