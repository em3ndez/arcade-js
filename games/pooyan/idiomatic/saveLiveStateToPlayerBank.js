// SPDX-License-Identifier: GPL-3.0-only
/**
 * saveLiveStateToPlayerBank — freeze the live actor/state page into whichever player's bank is
 * currently active.
 *
 * ROM 0x1a47-0x1a63. Grounding: [seen].
 *
 * ROLE. Pooyan keeps one LIVE page of per-actor and per-round state at SPEED_INDEX (0x8900) —
 * the working copy the engine drives each frame — and a saved BANK per player: player 0 at
 * 0x8940, player 1 at 0x8980. When a turn ends, the live page is parked in the outgoing
 * player's bank so it can be reloaded next time that player is up. This is the general form of
 * that park: unlike saveLivePageToPlayer0Bank (which always writes player 0's bank and may flip
 * the active player), this routine simply saves to whichever bank ACTIVE_PLAYER (0x880d) already
 * selects, and changes no turn ownership.
 *
 * Before copying it clears one status byte that the CALLER staged. The caller leaves a page
 * number in the H register; the ROM's entry does `ld l,0x04`, so the cleared cell is
 * (callerPage:0x04) — byte 4 of the caller's own page (e.g. 0x8904 or 0x8104), not a fixed
 * address. That per-page status byte is zeroed first, then the block copy runs.
 *
 * The copied span is 0x3f (63) bytes — the whole live page short of its final byte.
 *
 * A pure leaf: it writes RAM only and calls nothing.
 *
 * LIVE-OUT: memory-only — the cleared (callerPage:0x04) status byte, the 0x3f-byte destination
 * bank (0x8940 or 0x8980), and PLAY_STATE_INDEX (0x880a) cleared to 0. No register or flag is
 * returned.
 */
import {
  ACTIVE_PLAYER,
  PLAYER0_STATE_BANK,
  PLAYER1_STATE_BANK,
  PLAY_STATE_INDEX,
  SPEED_INDEX,
} from "./names.js";

// SPEED_INDEX (0x8900) is byte 0 of the live actor/state page; this alias names it as the copy
// SOURCE so the loop reads as "live page -> saved bank".
const LIVE_STATE_PAGE = SPEED_INDEX; // base of the live actor/state page — SPEED_INDEX is its byte 0
// 0x3f (63) bytes — the length the ROM's ldir moves (bc = 0x003f) from 0x8900..0x893e.
const BANK_SIZE = 0x3f;

export function saveLiveStateToPlayerBank(m, callerPage = m.regs.h) {
  const { mem8 } = m;

  // Clear the (callerPage:0x04) status byte the caller seated in its page. The ROM keeps the
  // caller's H and only sets L = 0x04, so this store lands in the caller's page (e.g. 0x8904 /
  // 0x8104) rather than at a fixed address — zeroing a per-page status flag before the save.
  mem8[(callerPage << 8) | 0x04] = 0x00; // clear the (page:04) status byte the caller seated

  // Route the save to the active player's bank: player 0's (0x8940) when ACTIVE_PLAYER (0x880d)
  // is 0, else player 1's (0x8980).
  const dest = mem8[ACTIVE_PLAYER] === 0 ? PLAYER0_STATE_BANK : PLAYER1_STATE_BANK;

  // Block-copy the live page (0x8900) into that bank — the ROM's ldir of 63 bytes,
  // 0x8900..0x893e -> dest..dest+0x3e — parking the outgoing state for reload.
  for (let i = 0; i < BANK_SIZE; i++) mem8[dest + i] = mem8[LIVE_STATE_PAGE + i];

  // Reset the in-play sub-state index (PLAY_STATE_INDEX, 0x880a) to 0 so the state machine
  // restarts from its first phase for the incoming turn.
  mem8[PLAY_STATE_INDEX] = 0x00;
}
