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
 * loc_1bcc — snapshot the live page into player 1's bank, then run a signature tripwire.
 *
 * With player 0 still alive it deselects that player. It copies the live state page into
 * player 1's saved bank, clears the play sub-state index, then folds the low 5 bits of a
 * fixed block of read-only program bytes onto the pointer the copy left behind. Unless that
 * fold lands on the expected sentinel word it bumps the signature tamper counter.
 *
 * LIVE-OUT: memory only — the bank copy, the two cleared cells, and the (conditional)
 * tamper bump. A is left as scratch and no caller consumes it.
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

  if (mem8[PLAYER0_LIVES] !== 0) mem8[ACTIVE_PLAYER] = 0;

  for (let i = 0; i < BANK_SIZE; i++) mem8[PLAYER1_STATE_BANK + i] = mem8[LIVE_PAGE + i];
  mem8[PLAY_STATE_INDEX] = 0;

  // Quirk: the checksum seeds from the advanced copy pointer, not zero, then adds each
  // block byte masked to its low 5 bits.
  let sig = u16(PLAYER1_STATE_BANK + BANK_SIZE);
  for (let i = 0; i < SIG_BYTES; i++) sig = u16(sig + (mem8[TAMPER_CHECKSUM_CODE_BASE + i] & NIBBLE_MASK));

  if ((sig & 0xff) === SENTINEL_LO && (sig >> 8) === SENTINEL_HI) return; // matched
  mem8[TAMPER_STRIKES_SIG] = mem8[TAMPER_STRIKES_SIG] + 1;
}
