// SPDX-License-Identifier: GPL-3.0-only
import { setActorAnimation } from "./setActorAnimation.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import {
  EAGLE_X_COORD,
  EAGLE_Y_COORD,
  EAGLE_ODD_RECORD_ANIM,
  EAGLE_EVEN_RECORD_ANIM,
  WAVE_RECORDS_ARRIVED,
  WAVE_INDEX,
  WAVE_ARRIVAL_CMD_BASE,
} from "./names.js";
/**
 * advanceEagleToArrivalAndTallyWave — eagle approach state for the record based at IX.
 *
 * Returns unless the eagle has reached this record's grid slot: its column (X >> 3) must
 * equal the record's target column or the one just before it, and its row (Y >> 3 + 4) must
 * fall within a five-row window above the record's target row. On arrival it advances the
 * record state and arms an animation — odd records (bit 3 of IXL) get one animation and a
 * flag byte; even records get another, bump the arrived count, and once every record of the
 * wave has arrived queue the wave-arrival command (base offset by the arrived count).
 *
 * LIVE-OUT: memory only — record fields, the arrived count, and the queued command.
 */

export function advanceEagleToArrivalAndTallyWave(m, rec = m.regs.ix) {
  const { mem8 } = m;

  const column = mem8[EAGLE_X_COORD] >> 3;
  const targetColumn = mem8[rec + 0x06];
  if (column !== targetColumn && ((column + 1) & 0xff) !== targetColumn) return;

  const row = ((mem8[EAGLE_Y_COORD] >> 3) + 0x04) & 0xff;
  const targetRow = mem8[rec + 0x04];
  if (row !== targetRow) {
    if (row < targetRow) return; //                       eagle above the target row
    if (((row - 0x05) & 0xff) >= targetRow) return; //     outside the five-row window
  }

  mem8[rec + 0x02] = (mem8[rec + 0x02] + 1); //     advance record state
  if ((rec & 0x08) !== 0) { //                             odd record (bit 3 of IXL)
    setActorAnimation(m, rec, EAGLE_ODD_RECORD_ANIM);
    mem8[rec + 0x09] = 0x38;
    return;
  }

  setActorAnimation(m, rec, EAGLE_EVEN_RECORD_ANIM);
  mem8[rec + 0x09] = 0x40;
  const arrived = (mem8[WAVE_RECORDS_ARRIVED] + 1) & 0xff;
  mem8[WAVE_RECORDS_ARRIVED] = arrived;
  if (mem8[WAVE_INDEX] !== arrived) return; //             wave not yet complete

  const cmdLow = ((WAVE_ARRIVAL_CMD_BASE & 0xff) + arrived) & 0xff;
  enqueueDisplayCommand(m, WAVE_ARRIVAL_CMD_BASE - (WAVE_ARRIVAL_CMD_BASE & 0xff) + cmdLow);
}
