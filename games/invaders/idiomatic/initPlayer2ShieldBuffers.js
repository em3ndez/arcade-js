// SPDX-License-Identifier: GPL-3.0-only
import { initShieldBuffers } from "./initShieldBuffers.js";
import { PLAYER2_SHIELD_BUFFER } from "./names.js";

/**
 * initPlayer2ShieldBuffers — stamp fresh shields into player 2's backup buffer.
 *
 * WHAT IT IS
 *   The thin front door that fills player 2's shield backup with pristine bunkers. Each player owns a
 *   backup buffer for the four on-screen shields inside its own work-RAM page — player 2's lives at
 *   PLAYER2_SHIELD_BUFFER (0x2242) — and this seats that base and replicates the shield template into it.
 *
 * ROLE IN THE MACHINE
 *   Run at player 2's round setup, before the shields are painted to the screen. It hands the buffer
 *   base to the shared body initShieldBuffers, which copies the 0x2c-byte shield template (from 0x1d20)
 *   four times into consecutive 0x2c-byte slots — one per bunker. Its player-1 twin initPlayer1ShieldBuffers
 *   does the same at 0x2142. Because the backup lives in the per-player page, each player's bunker damage
 *   persists across turns.
 *
 * ROM 0x01f5-...  Grounding: [seen].
 *
 * LIVE-OUT: HL = the buffer end pointer (returned straight through from initShieldBuffers).
 */
export function initPlayer2ShieldBuffers(m) {
  // Seat player 2's shield-buffer base, then let the shared filler replicate the template into its four slots.
  return initShieldBuffers(m, PLAYER2_SHIELD_BUFFER);
}
