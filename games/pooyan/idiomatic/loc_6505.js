// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_6523 } from "./loc_6523.js";
import { queueSound82ThenRun1C } from "./queueSound82ThenRun1C.js";
import { SHARED_FRAME_DELAY_TIMER, BLINK_PHASE } from "./names.js";
/**
 * loc_6505 — rst-0x28 dispatch handler (index 0). Seeds two frame/phase cells, then walks three
 * object records backward one stride per pass, seating each with the object-record seeder and
 * bumping its phase byte, and finally emits the tile-command run. The loop counter and record
 * pointer are locals, so no register-bank swap is needed.
 *
 * LIVE-OUT: A — the command-ring cursor left by the final emit (0 while its game-active gate is
 * closed); IX — the record pointer advanced past the three records (base - 3*stride). Both set for
 * the register-dispatched caller. B/DE/HL are dead (not restored).
 */

const RECORD_STRIDE = 0x18;
const RECORD_COUNT = 0x03;
const REC_PHASE_FIELD = 0x02; // record byte bumped each pass
const DELAY_SEED = 0x1c; //     seeded into the shared frame-delay timer
const PHASE_SEED = 0x08; //     seeded into the blink-phase cell

export function loc_6505(m, ix = m.regs.ix) {
  const { mem8 } = m;

  mem8[SHARED_FRAME_DELAY_TIMER] = DELAY_SEED;
  mem8[BLINK_PHASE] = PHASE_SEED;

  let record = ix;
  for (let i = 0; i < RECORD_COUNT; i++) {
    loc_6523(m, record); // seat the object record + enqueue its spawn display command(s)
    mem8[u16(record + REC_PHASE_FIELD)] = mem8[u16(record + REC_PHASE_FIELD)] + 1;
    record = u16(record - RECORD_STRIDE);
  }

  return [(m.regs.ix = record), queueSound82ThenRun1C(m)]; // IX = advanced pointer; A = emit's ring cursor
}
