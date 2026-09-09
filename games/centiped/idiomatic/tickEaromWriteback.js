// SPDX-License-Identifier: GPL-3.0-only
import { readEaromCell } from "./readEaromCell.js";
import { loc_00, loc_f9, loc_fa, HIGH_SCORE_TABLE, EAROM_DATA_WINDOW, EAROM_CONTROL } from "./names.js";

/**
 * tickEaromWriteback — periodic NVRAM erase/write machine that flushes the RAM high-score
 * mirror back one slot per pass.
 *
 * The high-score table lives in RAM (HIGH_SCORE_TABLE $0178 [seen]) but must be persisted to
 * the ER2055 EAROM so scores survive a power cycle. The EAROM is slow: erasing a cell and
 * writing a cell each take a whole phase of real chip time, so this routine can NEVER burn a
 * cell in a single frame. Instead it is a background state machine, called once per frame from
 * the main loop, that does at most one chip operation per pass and spreads a full table flush
 * across many frames without ever stalling the game.
 *
 * Two zero-page cells drive it:
 *   - loc_f9 ($f9) — the writeback cursor: which slot to flush next; high bit set == nothing pending.
 *   - loc_fa ($fa) — a phase bitstream: its low bit selects the ERASE half vs the COMMIT half,
 *                    shifted out one bit per pass so the two halves alternate.
 * It also gates itself to every 4th frame off loc_00's low 2 bits, further throttling chip access.
 *
 * ROM 0x… . Grounding: [code] — flow read from behaviour; the EAROM ports (EAROM_CONTROL $1680,
 * EAROM_DATA_WINDOW $1600) are [seen]. Live-out: the EAROM cell state, the cursor $f9, and phase $fa.
 */
export function tickEaromWriteback(m) {
  const { mem8 } = m;
  // Frame gate: act only on every 4th frame. loc_00's low 2 bits are the frame phase;
  // on the other three frames of every four there is nothing to do.
  let a = mem8[loc_00] & 0x03;               // frame phase
  if (a !== 0) return;                        // act only every 4th frame
  // a == 0 here, so this write releases the chip's control lines before we start —
  // making sure no stale erase/write strobe is still asserted from a prior pass.
  mem8[EAROM_CONTROL] = a;                         // a == 0: release the control lines
  // Load the cursor. If its high bit is set (0x80/0xff sentinel) the mirror matches the
  // device and there is nothing to flush — bail.
  let x = mem8[loc_f9];                       // writeback cursor
  if (x & 0x80) return;                       // no slot pending
  // Advance the phase bitstream: read its current low bit (this pass's half) and shift
  // the stream right so the next pass sees the following bit.
  const phase = mem8[loc_fa];
  mem8[loc_fa] = phase >> 1;                  // shift out old bit0
  if ((phase & 0x01) !== 0) {                 // commit half
    // COMMIT half: the cell was erased on the previous pass; now actually write the
    // latched byte into it. 0x02 arms write mode, 0x0a strobes the commit.
    mem8[EAROM_CONTROL] = 0x02;                    // arm write
    mem8[EAROM_CONTROL] = 0x0a;                    // strobe: commit the latched byte
    // This slot is now fully persisted; step the cursor down to the next slot.
    mem8[loc_f9] = x - 1;
    return;
  }
  // SCAN/ERASE half: walk the cursor downward looking for the first slot whose NVRAM
  // byte disagrees with the RAM mirror (a "dirty" slot that needs persisting).
  // scan/erase half
  for (;;) {
    a = readEaromCell(m, a, x);              // A = cell[X]
    if (a !== mem8[HIGH_SCORE_TABLE + x]) {          // mismatch -> dirty slot
      // Found a dirty slot. Park the cursor on it so the commit half returns here,
      mem8[loc_f9] = x;                       // park on the dirty slot
      // arm an erase (0x06), latch the RAM byte we want to persist into the chip's
      // address/data window, and strobe 0x0e to erase the cell. The actual write of
      // this byte happens on the NEXT pass (the commit half).
      mem8[EAROM_CONTROL] = 0x06;                  // arm erase
      const want = mem8[HIGH_SCORE_TABLE + x];        // the RAM byte to persist
      mem8[EAROM_DATA_WINDOW + x] = want;
      mem8[EAROM_CONTROL] = 0x0e;                  // strobe: erase cell (write commits next phase)
      // Flip the phase stream so the next pass takes the commit half.
      mem8[loc_fa] = mem8[loc_fa] + 1;        // flip to the commit phase
      return;
    }
    // This slot already agrees with the mirror; step down and keep scanning.
    x = (x - 1) & 0xff;
    if (x & 0x80) break;                      // every slot matched
  }
  // Fell off the bottom (x wrapped to 0xff): every slot agrees, so park the sentinel —
  // nothing left to persist until the mirror changes again.
  mem8[loc_f9] = x;                            // x == 0xff: nothing pending
}
