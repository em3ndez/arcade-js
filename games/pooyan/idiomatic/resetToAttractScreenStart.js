// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  WATCHDOG_KICK,
  loc_8819,
  ATTRACT_SUBSTATE,
  TAMPER_OBJECT_FREEZE_FLAG,
  GAME_ACTIVE_FLAG,
} from "./names.js";
import { loc_02e3 } from "./loc_02e3.js";
import { loc_02b9 } from "./loc_02b9.js";
import { stampSecondScrollColumn } from "./stampSecondScrollColumn.js";
/**
 * resetToAttractScreenStart — attract sub-state 0 handler (attract dispatch target 0).
 *
 * Kicks the watchdog and clears a scratch byte, arms the row-by-row tile fill, advances the attract
 * sub-state, then runs a backward checksum from CKSUM_START down to the CKSUM_SENTINEL byte: the
 * running 8-bit sum lands in `sum` and the carry count in `carries`. On an intact program image
 * (CKSUM_SENTINEL - carries) is CKSUM_EXPECTED; any other value raises the anti-tamper object-freeze
 * flag. Finally clears the in-play gate and hands to the board-init RAM clear + sprite-slot tail.
 *
 * LIVE-OUT: none — a void attract handler that returns to the dispatcher's caller.
 */
const CKSUM_START = 0x64d5; // address the backward checksum begins at
const CKSUM_SENTINEL = 0x96; // byte value that halts the scan
const CKSUM_EXPECTED = 0x8f; // (CKSUM_SENTINEL - carries) on an intact image

export function resetToAttractScreenStart(m) {
  const { mem8 } = m;

  mem8[WATCHDOG_KICK] = 0; // A = 0 written to each cell below
  mem8[loc_8819] = 0;
  loc_02e3(m); // arm the row-by-row tile fill
  mem8[ATTRACT_SUBSTATE] = (mem8[ATTRACT_SUBSTATE] + 1) & 0xff; // advance sub-state

  let sum = 0;
  let carries = 0;
  let ptr = CKSUM_START;
  for (;;) {
    const b = mem8[ptr];
    if (b === CKSUM_SENTINEL) break;
    const raw = b + sum;
    if (raw > 0xff) carries = (carries + 1) & 0xff;
    sum = raw & 0xff;
    ptr = u16(ptr - 1);
  }

  if (((CKSUM_SENTINEL - carries) & 0xff) !== CKSUM_EXPECTED) {
    mem8[TAMPER_OBJECT_FREEZE_FLAG] = 1; // checksum miss -> raise the tamper flag
  }

  mem8[GAME_ACTIVE_FLAG] = 0; // clear the in-play gate
  loc_02b9(m); // zero the board-init RAM regions
  stampSecondScrollColumn(m); // sprite-slot tail
}
