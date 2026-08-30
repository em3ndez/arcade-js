// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  PLAYER0_LIVES,
  ACTIVE_PLAYER,
  PLAYER1_STATE_BANK,
  SPEED_INDEX,
  PLAY_STATE_INDEX,
  TAMPER_CHECKSUM_CODE_BASE,
  TAMPER_STRIKES_SIG,
} from "./names.js";
/**
 * loc_1bcc — park the live actor page into player 1's saved bank, then run an anti-tamper
 * signature check on the program ROM.
 * ROM 0x1bcc-0x1c02.  Grounding: [seen].
 *
 * Pooyan is a two-player alternating game, so when a turn ends the machine has to freeze the
 * player's live state somewhere and hand the hardware to the other player. This routine does the
 * player-1 half of that swap and, riding along on the same handler, one of the game's several
 * copy-protection tripwires.
 *
 * The work is three pieces:
 *   1. If player 0 still has lives left (PLAYER0_LIVES, 0x8948, nonzero) it deselects that
 *      player by clearing ACTIVE_PLAYER (0x880d) to 0 — the turn is being parked, not ended for
 *      good, so control reverts to the "no player currently active" selector.
 *   2. It copies the whole live state page — 0x3f bytes starting at the live-page base (0x8900,
 *      the cell SPEED_INDEX also names) — into player 1's saved bank (PLAYER1_STATE_BANK,
 *      0x8980). This is the snapshot that will be restored when player 1 next takes a turn. It
 *      then clears the play sub-state index (PLAY_STATE_INDEX, 0x880a) so the restored turn
 *      resumes from a known sequencer state.
 *   3. It runs a self-checksum over a fixed 14-byte block of the program ROM
 *      (TAMPER_CHECKSUM_CODE_BASE, 0x5328 — bytes that are actually executable code elsewhere,
 *      read here as data) and, unless the running sum lands exactly on a hard-coded sentinel
 *      word, bumps the signature tamper counter (TAMPER_STRIKES_SIG, 0x8a38). A patched or
 *      dumped-and-modified ROM shifts those 14 bytes, the sentinel misses, and the strike
 *      counter climbs — the game degrades elsewhere once enough strikes accumulate.
 *
 * The checksum has a deliberate QUIRK that makes it hard to forge by hand: it does NOT start
 * from zero. The block copy in piece 2 leaves a running destination pointer sitting just past
 * the copied bank, at PLAYER1_STATE_BANK + 0x3f (= 0x89bf), and the checksum SEEDS from that
 * pointer value, then adds each of the 14 program bytes masked to its low 5 bits. So the
 * expected sentinel (low byte 0x60, high byte 0x8a) only comes out when both the copy landed
 * where it should AND the 14 ROM bytes are the genuine ones.
 *
 * A pure leaf: it calls nothing.
 *
 * LIVE-OUT: memory only — the parked bank copy, ACTIVE_PLAYER and PLAY_STATE_INDEX cleared, and
 * (on a checksum miss) the tamper strike counter bumped. The running checksum is scratch and no
 * caller consumes it.
 */

// SPEED_INDEX doubles as the base of the live actor/state page copied here.
const LIVE_PAGE = SPEED_INDEX;
const BANK_SIZE = 0x3f;
const SIG_BYTES = 0x0e; // program bytes folded into the checksum
const NIBBLE_MASK = 0x1f;
const SENTINEL_LO = 0x60; // expected checksum low byte (E)
const SENTINEL_HI = 0x8a; // expected checksum high byte (D)

export function loc_1bcc(m) {
  const { mem8 } = m;

  // Park, don't end: if player 0 still has lives (PLAYER0_LIVES, 0x8948) deselect that player
  // (ACTIVE_PLAYER, 0x880d = 0) so the turn hands back without ending the game for player 0.
  if (mem8[PLAYER0_LIVES] !== 0) mem8[ACTIVE_PLAYER] = 0;

  // Snapshot the live state page (0x3f bytes from the live-page base 0x8900) into player 1's
  // saved bank (PLAYER1_STATE_BANK, 0x8980), then clear the sub-state index (0x880a) so the
  // parked turn resumes from a known point when player 1 is restored.
  for (let i = 0; i < BANK_SIZE; i++) mem8[PLAYER1_STATE_BANK + i] = mem8[LIVE_PAGE + i];
  mem8[PLAY_STATE_INDEX] = 0;

  // Anti-tamper self-checksum. The seed is the copy's leftover destination pointer — one past
  // the parked bank, at PLAYER1_STATE_BANK + 0x3f (= 0x89bf) — NOT zero; this coupling is what
  // makes the sentinel depend on the copy having landed correctly. Then fold in 14 bytes of
  // program ROM at TAMPER_CHECKSUM_CODE_BASE (0x5328), each masked to its low 5 bits, as a
  // 16-bit running sum (low byte wrapping carries into the high byte).
  let sig = u16(PLAYER1_STATE_BANK + BANK_SIZE);
  for (let i = 0; i < SIG_BYTES; i++) sig = u16(sig + (mem8[TAMPER_CHECKSUM_CODE_BASE + i] & NIBBLE_MASK));

  // Genuine ROM lands the sum on the sentinel word (low 0x60, high 0x8a) and we return clean.
  // Any mismatch means the checked block was altered, so bump the signature tamper strike
  // counter (TAMPER_STRIKES_SIG, 0x8a38) — accumulated strikes degrade the game downstream.
  if ((sig & 0xff) === SENTINEL_LO && (sig >> 8) === SENTINEL_HI) return; // matched
  mem8[TAMPER_STRIKES_SIG] = mem8[TAMPER_STRIKES_SIG] + 1;
}
