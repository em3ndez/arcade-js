// SPDX-License-Identifier: GPL-3.0-only
/**
 * swapInActivePlayerPages  —  ROM 0x06ee  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The player-switch page swapper, IN direction, for a two-player cabinet — the mirror image of
 *   swapOutActivePlayerPages (ROM 0x0726). The two players share ONE set of "live" in-play cells (lane-
 *   object positions, the frog, home-bay gates, timers …), so a turn transition has to park the outgoing
 *   player's live state and pull the incoming player's state back into those same cells. Each player's
 *   state lives in a 183-byte WORK page (led by LANE_OBJECT_INDEX 0x80ff) plus a 43-byte OBJECT page
 *   (LIVE_OBJECT_PAGE 0x800c). This entry point handles player 1 itself; for any other active player it
 *   tail-delegates to the swap-OUT routine.
 *
 * WHERE IT SITS
 *   Called at two-player turn transitions (setUpBoardOrContinueLife swaps pages in when a two-player
 *   board is laid). It is the dispatcher for the whole swap: ACTIVE_PLAYER (0x83fd) == 1 runs the swap-IN
 *   body below; anything else returns the swap-OUT tail-call, which does the same shuffle with the two
 *   save areas playing the opposite roles. One-player games never swap (their single player's state is
 *   simply never parked — clearActivePlayerWorkRam skips the clear in a one-player game to preserve it).
 *
 * LIVE-OUT
 *   Memory only. For player 1 it moves 2×(183+43) bytes between RAM banks and writes one OBJRAM shadow
 *   byte; otherwise it returns whatever the swap-OUT tail returns (also nothing). It leaves no register
 *   the caller reads.
 */
import { ACTIVE_PLAYER, LIVE_OBJECT_PAGE, OTHER_PLAYER_OBJECT_PAGE, LANE_OBJECT_INDEX, OTHER_PLAYER_WORK_PAGE, OBJECT_PAGE_SAVE_BANK, OBJRAM_COL3F_ATTR_SHADOW, WORK_PAGE_SAVE_BANK } from "./names.js";
import { swapOutActivePlayerPages } from "./swapOutActivePlayerPages.js";

// This body is the player-1 branch. ACTIVE_PLAYER (0x83fd) holds the active player number (1 or 2).
const PLAYER_ONE = 1;

// Page sizes, grounded against MAME (same values the swap-OUT twin uses). The WORK page is 183 bytes (its
// head byte is the lane-object walk index LANE_OBJECT_INDEX 0x80ff); the OBJECT page is 43 bytes (based at
// LIVE_OBJECT_PAGE 0x800c). Both pages are copied whole, in both the bank-out and the restore-in halves.
const WORK_PAGE_BYTES = 183;
const OBJECT_PAGE_BYTES = 43;

// Straight byte-for-byte block move over the 8-bit memory view — the JS stand-in for the Z80 LDIR the
// original used to shuffle these pages. Copies n bytes from src.. to dst.. (ascending, non-overlapping).
function copyBytes(mem8, dst, src, n) {
  for (let i = 0; i < n; i++) mem8[dst + i] = mem8[src + i];
}

export function swapInActivePlayerPages(m) {
  const { mem8 } = m;

  // ── Dispatch: player 1 here, everyone else to the swap-OUT tail ───────────────────────
  // This routine only knows how to swap player 1's pages in. Any other active player is a plain tail-call
  // to swapOutActivePlayerPages (ROM 0x0726), which performs the equivalent shuffle with the "other
  // player" pair and the save-bank pair exchanging their source/destination roles.
  if (mem8[ACTIVE_PLAYER] !== PLAYER_ONE) return swapOutActivePlayerPages(m);

  // ── Bank the OUTGOING live pages into the "other player" pair ─────────────────────────
  // Player 1 is coming in, so first park whatever is currently live into the OTHER-player save area:
  //   • OBJECT page: LIVE_OBJECT_PAGE (0x800c) → OTHER_PLAYER_OBJECT_PAGE (0x85c0), 43 bytes
  //   • WORK page:   LANE_OBJECT_INDEX (0x80ff) → OTHER_PLAYER_WORK_PAGE  (0x8600), 183 bytes
  // NOTE the alternating roles: swap-IN banks OUT into the "other player" pair and restores FROM the
  // save-bank pair; swap-OUT does the exact reverse. The two save areas trade source/destination between
  // the two directions of the swap.
  copyBytes(mem8, OTHER_PLAYER_OBJECT_PAGE, LIVE_OBJECT_PAGE, OBJECT_PAGE_BYTES);
  copyBytes(mem8, OTHER_PLAYER_WORK_PAGE, LANE_OBJECT_INDEX, WORK_PAGE_BYTES);

  // ── Restore player 1's OBJECT page from the save-bank pair ────────────────────────────
  // Pull player 1's parked object page back into the shared live cells:
  //   • OBJECT page: OBJECT_PAGE_SAVE_BANK (0x86c0) → LIVE_OBJECT_PAGE (0x800c), 43 bytes
  copyBytes(mem8, LIVE_OBJECT_PAGE, OBJECT_PAGE_SAVE_BANK, OBJECT_PAGE_BYTES);

  // ── Refresh the OBJRAM per-column attribute shadow ────────────────────────────────────
  // OBJRAM_COL3F_ATTR_SHADOW (0x803f) is the work-RAM shadow of OBJRAM column 0x3f's attribute byte
  // (0xb03f). The NMI DMAs 0x8007–0x803f → 0xb007–0xb03f every frame, so writing 1 here sets that
  // column's attribute on the next vblank. (swapOutActivePlayerPages and renderCreditLine write 1 too.)
  // In the ROM this write lands BETWEEN the two page restores; the order is preserved here. It is safe
  // either way — 0x803f sits outside every page span copied above and below — but faithfulness is free.
  mem8[OBJRAM_COL3F_ATTR_SHADOW] = 1;

  // ── Restore player 1's WORK page from the save-bank pair ──────────────────────────────
  //   • WORK page: WORK_PAGE_SAVE_BANK (0x8500) → LANE_OBJECT_INDEX (0x80ff), 183 bytes
  // After this the one live cell set belongs to player 1, ready for their turn.
  copyBytes(mem8, LANE_OBJECT_INDEX, WORK_PAGE_SAVE_BANK, WORK_PAGE_BYTES);
}
