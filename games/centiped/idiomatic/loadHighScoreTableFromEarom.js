// SPDX-License-Identifier: GPL-3.0-only
import { readEaromCell } from "./readEaromCell.js";
import { HIGH_SCORE_TABLE, loc_f9 } from "./names.js";

/**
 * loadHighScoreTableFromEarom -- slurp the whole 64-byte high-score NVRAM into the
 * work-RAM mirror, then park the writeback cursor at "nothing pending".
 *
 * The high-score subsystem treats HIGH_SCORE_TABLE ($0178 [seen]) as an ordinary RAM
 * block, but its authoritative copy lives in the slow ER2055 EAROM. At boot the machine
 * has to prime that RAM mirror from the chip so the rest of the game sees the persisted
 * scores as normal memory. This routine does exactly that: it reads all 64 cells out of
 * the device (via readEaromCell) into the mirror, top slot down to slot 0.
 *
 * The subtle, load-bearing detail is the cursor store AFTER the loop. loc_f9 ($f9 [code])
 * is the background writeback ticker's cursor: it names the next slot the ticker should
 * flush from RAM back to the chip, and its high bit (0x80 set, i.e. 0xff) is the sentinel
 * "no dirty slot pending". Because the loop counts X from 0x3f down and exits when X goes
 * negative, X has wrapped to 0xff by the store — and that 0xff is precisely the sentinel.
 * This is correct by construction: the mirror was just read fresh from the device, so it
 * agrees with NVRAM byte-for-byte and the writeback ticker has nothing to persist.
 *
 * ROM 0x… . Grounding: HIGH_SCORE_TABLE is [seen]; the cursor semantics are [code].
 * Live-out: the 64-byte RAM mirror, the cursor (== 0xff), and the device state the
 * cell read leaves (address latched to 0, data-out = cell 0). Registers A/X are dead.
 */
export function loadHighScoreTableFromEarom(m, a = m.regs.a) {
  const { mem8 } = m;
  // Read every EAROM cell (index 0x3f down to 0) into the RAM mirror. Descending so
  // that X naturally wraps to 0xff on loop exit — the value reused as the "clean" cursor.
  for (let x = 0x3f; x >= 0; x--) {
    // readEaromCell returns cells[X] in A. The incoming A is threaded through the call
    // signature but is a don't-care: the read overwrites it (it is the latched data byte).
    a = readEaromCell(m, a, x); // A = cells[X]; A_in is threaded but a don't-care (the read overwrites it)
    mem8[HIGH_SCORE_TABLE + x] = a;
  }
  // X is now 0xff (wrapped past 0). Store it as the writeback cursor: high bit set ==
  // "no writeback pending", because the mirror is freshly loaded and matches the device.
  mem8[loc_f9] = 0xff; // stx $f9 — X wrapped to 0xff: no writeback pending
}
