// SPDX-License-Identifier: GPL-3.0-only
/**
 * swapOutActivePlayerPages  —  ROM 0x0726  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The player-switch page swapper, OUT direction, for a two-player cabinet. The two players share a
 *   single set of "live" in-play cells (lane-object positions, the frog, home-bay gates, timers …), so
 *   before a turn can pass from one player to the other the outgoing player's live state must be parked
 *   and the incoming player's state pulled back into those same cells. Each player's state lives in a
 *   183-byte WORK page (led by LANE_OBJECT_INDEX 0x80ff) plus a 43-byte OBJECT page (LIVE_OBJECT_PAGE
 *   0x800c). This routine banks the currently-active player's two live pages into a save bank and
 *   restores the incoming player's two pages into the live locations — so afterwards the one live cell
 *   set belongs to the other player.
 *
 * WHERE IT SITS
 *   Called at two-player turn transitions. swapInActivePlayerPages (ROM 0x06ee) is the entry point: it
 *   handles player 1 itself (the mirror-image swap-IN) and tail-delegates HERE for any other active
 *   player — so this is the swap taken when switching to/for player 2. One-player games never reach it
 *   (their single player's state is never swapped; clearActivePlayerWorkRam skips the clear in a
 *   one-player game precisely to preserve that state).
 *
 * LIVE-OUT
 *   Memory only. It moves 2×(183+43) bytes between RAM banks, writes one OBJRAM shadow byte, and — the
 *   first time only — clears the start flag and arms a one-shot latch. It returns nothing and leaves no
 *   register the caller reads.
 */
import {
  LANE_OBJECT_INDEX, WORK_PAGE_SAVE_BANK, LIVE_OBJECT_PAGE, OBJECT_PAGE_SAVE_BANK, OTHER_PLAYER_WORK_PAGE, OTHER_PLAYER_OBJECT_PAGE,
  OBJRAM_COL3F_ATTR_SHADOW, INIT_GUARD_LATCH, TWO_PLAYER_START_FLAG,
} from "./names.js";

// Page sizes, grounded against MAME. The WORK page is 183 bytes (its head byte is the lane-object walk
// index LANE_OBJECT_INDEX 0x80ff); the OBJECT page is 43 bytes (based at LIVE_OBJECT_PAGE 0x800c). Both
// pages are copied whole, in both the bank-out and the restore-in halves below.
const WORK_PAGE_BYTES = 183;
const OBJECT_PAGE_BYTES = 43;

// Straight byte-for-byte block move over the 8-bit memory view — the JS stand-in for the Z80 LDIR the
// original used to shuffle these pages. Copies n bytes from src.. to dst.. (ascending, non-overlapping).
function copyBytes(mem8, dst, src, n) {
  for (let i = 0; i < n; i++) mem8[dst + i] = mem8[src + i];
}

export function swapOutActivePlayerPages(m) {
  const { mem8 } = m;

  // ── Bank the OUTGOING player's live pages into the save-bank pair ─────────────────────
  // The currently-active player is leaving, so snapshot both of their live pages into the save bank:
  //   • WORK page:  LANE_OBJECT_INDEX (0x80ff) → WORK_PAGE_SAVE_BANK (0x8500), 183 bytes
  //   • OBJECT page: LIVE_OBJECT_PAGE (0x800c) → OBJECT_PAGE_SAVE_BANK (0x86c0), 43 bytes
  // This parks everything the outgoing player will need when their turn comes back around.
  copyBytes(mem8, WORK_PAGE_SAVE_BANK, LANE_OBJECT_INDEX, WORK_PAGE_BYTES);
  copyBytes(mem8, OBJECT_PAGE_SAVE_BANK, LIVE_OBJECT_PAGE, OBJECT_PAGE_BYTES);

  // ── Restore the INCOMING player's pages into the live locations ───────────────────────
  // Pull the other player's parked state back into the shared live cells, from the "other player" pair:
  //   • WORK page:  OTHER_PLAYER_WORK_PAGE (0x8600) → LANE_OBJECT_INDEX (0x80ff), 183 bytes
  //   • OBJECT page: OTHER_PLAYER_OBJECT_PAGE (0x85c0) → LIVE_OBJECT_PAGE (0x800c), 43 bytes
  // The two save areas alternate roles between the two directions of the swap: swap-IN banks OUT into
  // the "other player" pair and restores FROM the save-bank pair; swap-OUT (here) does the reverse.
  copyBytes(mem8, LANE_OBJECT_INDEX, OTHER_PLAYER_WORK_PAGE, WORK_PAGE_BYTES);
  copyBytes(mem8, LIVE_OBJECT_PAGE, OTHER_PLAYER_OBJECT_PAGE, OBJECT_PAGE_BYTES);

  // ── Refresh the OBJRAM per-column attribute shadow ────────────────────────────────────
  // OBJRAM_COL3F_ATTR_SHADOW (0x803f) is the work-RAM shadow of OBJRAM column 0x3f's attribute byte
  // (0xb03f). The NMI DMAs 0x8007–0x803f → 0xb007–0xb03f every frame, so writing 1 here sets that
  // column's attribute on the next vblank. (swapInActivePlayerPages and renderCreditLine write 1 too.)
  mem8[OBJRAM_COL3F_ATTR_SHADOW] = 1;

  // ── One-shot init guard ───────────────────────────────────────────────────────────────
  // INIT_GUARD_LATCH (0x8295) makes the two writes below fire exactly once. If it is already set the
  // one-time init has run, so we are done.
  if (mem8[INIT_GUARD_LATCH] !== 0) return;

  // First time through: clear the 2-player start flag TWO_PLAYER_START_FLAG (0x825b) (raised elsewhere
  // by raiseTwoPlayerStartFlag; restored to 0 here as part of the initial hand-off) and latch the guard
  // so this clear never repeats.
  mem8[TWO_PLAYER_START_FLAG] = 0;
  mem8[INIT_GUARD_LATCH] = 1;
}
