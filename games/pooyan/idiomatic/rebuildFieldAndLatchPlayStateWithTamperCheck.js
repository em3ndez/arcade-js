// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { clearBoardRamAndBlankFillRow } from "./clearBoardRamAndBlankFillRow.js";
import { armTileFillFromPlayfieldBase } from "./armTileFillFromPlayfieldBase.js";
import { fillAttributeColumns } from "./fillAttributeColumns.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { renderPlayTimerNibblesAndGuardChecksum } from "./renderPlayTimerNibblesAndGuardChecksum.js";
import { copyBiasedTileString } from "./copyBiasedTileString.js";
import {
  FIELD_ATTRIB_SRC_0819,
  DISPLAY_CMD_0600,
  DISPLAY_CMD_0602,
  PLAY_STATE_INDEX,
  PHASE_TIMER,
  TAMPER_CKSUM_BASE_5593,
  TAMPER_FREEZE_FLAG,
  BIASED_TILE_STRING_1FF2,
  DISPLAY_MSG_BUF,
} from "./names.js";
/**
 * rebuildFieldAndLatchPlayStateWithTamperCheck — a play-state dispatch handler (a sibling play-state handler) with a self-check.
 *
 * Ticks one row of the tilemap clear and bails while it drains. Once drained it re-arms the fill
 * from the fixed start, floods the attribute columns, enqueues two display commands, runs the shared
 * integrity/timer handler, then latches the play sub-state (0x0c) and clears the phase timer. It next
 * folds a 34-byte program-memory block into a rolling checksum; a result other than 0x7c bumps the tamper-freeze
 * tally. Finally it copies a biased character string into the message buffer.
 *
 * LIVE-OUT: none — a jump-table handler whose caller discards register/flag results.
 */

const NEXT_SUBSTATE = 0x0c; // play sub-state index latched on completion
const CKSUM_LEN = 0x22; //     bytes folded into the rolling checksum
const CKSUM_MASK = 0x37; //    per-byte mask before the rotate/accumulate
const CKSUM_MATCH = 0x7c; //   intact-image checksum; anything else is a tamper

export function rebuildFieldAndLatchPlayStateWithTamperCheck(m) {
  const { mem8 } = m;

  const drained = clearBoardRamAndBlankFillRow(m);
  if (!drained) return; // still draining -> bail (the `ret nz` path)

  armTileFillFromPlayfieldBase(m);
  fillAttributeColumns(m, FIELD_ATTRIB_SRC_0819);
  enqueueDisplayCommand(m, DISPLAY_CMD_0600);
  enqueueDisplayCommand(m, DISPLAY_CMD_0602);
  renderPlayTimerNibblesAndGuardChecksum(m);
  mem8[PLAY_STATE_INDEX] = NEXT_SUBSTATE;
  mem8[PHASE_TIMER] = 0;

  // Rolling checksum: mask each byte, rotate right (bit 0 -> carry), add-with-carry into the sum.
  let acc = 0;
  let ptr = TAMPER_CKSUM_BASE_5593;
  for (let i = 0; i < CKSUM_LEN; i++) {
    const masked = mem8[ptr] & CKSUM_MASK;
    const carry = masked & 0x01;
    const rotated = ((masked >> 1) | (carry << 7)) & 0xff;
    acc = (rotated + acc + carry) & 0xff;
    ptr = u16(ptr + 1);
  }
  if (acc !== CKSUM_MATCH) mem8[TAMPER_FREEZE_FLAG] = mem8[TAMPER_FREEZE_FLAG] + 1;

  copyBiasedTileString(m, BIASED_TILE_STRING_1FF2, DISPLAY_MSG_BUF);
}
