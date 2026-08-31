// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { fillByteRun } from "./fillByteRun.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { renderGaugeAndSetPlayStateForPlayer } from "./renderGaugeAndSetPlayStateForPlayer.js";
import {
  ACTIVE_PLAYER,
  INTEGRITY_CHECKSUM_CODE_BLOCK,
  INTEGRITY_FLAG_SCAN_BASE,
  PLAY_TIMER_BCD_P1,
  PLAY_TIMER_BCD_P2,
  PLAY_TIMER_DIGIT_VRAM,
  TAIL_CHECKSUM_GUARD,
} from "./names.js";
/**
 * renderPlayTimerNibblesAndGuardChecksum — the shared integrity + play-timer nibble-render handler.
 *
 * Enqueues one fixed display command, then folds a 16-bit checksum (plus a second sum of the
 * running low byte taken only at even offsets) over a fixed code block and matches all four
 * bytes against the guards that trail the block, tripping if they disagree. It then splits the
 * active player's timer minutes and seconds BCD bytes into hi/lo nibble tiles up a video column
 * (separated by a spacer tile), clears those timer bytes, and scans a small flag block: if any
 * flag is set it runs a second summed check whose failure either trips or repaints the phase
 * gauge, and otherwise it just returns.
 *
 * LIVE-OUT: none — both dispatch callers reload every register before reading one, so no
 * register survives; the whole effect is in memory.
 */

const DISPLAY_CMD = (0x06 << 8) | 0x09; // the fixed two-byte command enqueued on entry
const CHECKSUM_LEN = 0x5b; //             count of bytes folded by the entry checksum
const ROW_STRIDE = 0x20; //               one tilemap row (subtracted to walk up the column)
const SPACER_TILE = 0x51; //              separator tile between the minute and second digits
const TAIL_SENTINEL = 0xc9; //            byte that terminates the tail sum
const FLAG_COUNT = 7; //                  flag bytes scanned after the render
const TAIL_SEED_LO = 0xe0; //             tail-sum seed left in the low byte by the column stride
const TAIL_SEED_HI = 0xff; //             tail-sum seed left in the high byte by the column stride

export function renderPlayTimerNibblesAndGuardChecksum(m) {
  const { mem8 } = m;

  enqueueDisplayCommand(m, DISPLAY_CMD);

  // Entry integrity check: fold the block into a 16-bit sum, plus a second sum of the running
  // low byte taken only at even offsets, and match all four result bytes against the guards.
  let sumLo = 0, sumHi = 0, evenLo = 0, evenHi = 0;
  let src = INTEGRITY_CHECKSUM_CODE_BLOCK;
  for (let i = 0; i < CHECKSUM_LEN; i++) {
    const acc = mem8[src] + sumLo;
    if (acc > 0xff) sumHi = (sumHi + 1) & 0xff;
    sumLo = acc & 0xff;
    if ((src & 1) === 0) {
      const acc2 = sumLo + evenLo;
      if (acc2 > 0xff) evenHi = (evenHi + 1) & 0xff;
      evenLo = acc2 & 0xff;
    }
    src = u16(src + 1);
  }
  const guard = INTEGRITY_CHECKSUM_CODE_BLOCK + CHECKSUM_LEN;
  if (sumLo !== mem8[guard] || sumHi !== mem8[guard + 1]
      || evenLo !== mem8[guard + 2] || evenHi !== mem8[guard + 3]) {
    throw new Error("renderPlayTimerNibblesAndGuardChecksum: entry integrity checksum mismatch (unreachable with intact data)");
  }

  // Render the active player's timer minutes then seconds as hi/lo nibble tiles up the column,
  // parting them with a spacer tile.
  const minutes = mem8[ACTIVE_PLAYER] !== 0 ? PLAY_TIMER_BCD_P2 + 2 : PLAY_TIMER_BCD_P1 + 2;
  let timer = minutes;
  let cell = PLAY_TIMER_DIGIT_VRAM;
  for (let pass = 2; pass > 0; pass--) {
    const value = mem8[timer];
    mem8[cell] = (value & 0xf0) >> 4;
    cell = u16(cell - ROW_STRIDE);
    mem8[cell] = value & 0x0f;
    cell = u16(cell - ROW_STRIDE);
    if ((pass & 1) !== 0) {
      cell = u16(cell - 1);
    } else {
      mem8[cell] = SPACER_TILE;
      cell = u16(cell - ROW_STRIDE);
      timer = u16(timer - 1);
    }
  }

  // Clear the three timer bytes that were just rendered.
  fillByteRun(m, timer, 0, 3);

  // Scan the flag block; a clear block returns, else divert to the tail check.
  let flag = INTEGRITY_FLAG_SCAN_BASE;
  let diverted = false;
  for (let i = 0; i < FLAG_COUNT; i++) {
    if (mem8[flag] !== 0) { diverted = true; break; }
    flag = u16(flag + 1);
  }
  if (!diverted) return;

  // Tail integrity check: sum from the first set flag to the sentinel, verify the two-byte
  // result; a low-byte miss trips, a high-byte miss repaints the phase gauge instead.
  let tailLo = TAIL_SEED_LO, tailHi = TAIL_SEED_HI;
  for (;;) {
    const value = mem8[flag];
    if (value === TAIL_SENTINEL) break;
    const acc = value + tailLo;
    if (acc > 0xff) tailHi = (tailHi + 1) & 0xff;
    tailLo = acc & 0xff;
    flag = u16(flag + 1);
  }
  if (tailLo !== mem8[TAIL_CHECKSUM_GUARD]) {
    throw new Error("renderPlayTimerNibblesAndGuardChecksum: tail integrity checksum mismatch (unreachable with intact data)");
  }
  if (tailHi !== mem8[TAIL_CHECKSUM_GUARD + 1]) {
    renderGaugeAndSetPlayStateForPlayer(m);
    return;
  }
  return;
}
