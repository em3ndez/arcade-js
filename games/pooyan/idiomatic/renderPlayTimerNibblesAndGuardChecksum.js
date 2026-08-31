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
 * renderPlayTimerNibblesAndGuardChecksum — shared integrity-guard + play-timer nibble-render handler.
 *
 * ROM 0x7960 (0x7960-0x7a0a). Grounding: [seen].
 *
 * WHAT IT IS: one of the ROM's anti-tamper tripwires, hidden inside the routine that repaints
 * the active player's remaining-time digits. This is the machine's characteristic anti-tamper
 * style — a passive integrity check folded into an ordinary render, so that keeping the HUD
 * up to date also keeps re-verifying that the program image has not been altered. Two dispatch
 * sites share this one handler, so the guard runs every time the timer HUD is redrawn. On an
 * intact image every check passes silently; the failure paths only ever fire on a corrupted
 * ROM, where they refuse to continue.
 *
 * ITS ROLE IN THE MACHINE — what it does, in order:
 *   1. Enqueues one fixed two-byte display command (command class 0x06, argument 0x09) into the
 *      per-frame display-command ring for the drain loop to act on later.
 *   2. ENTRY INTEGRITY GUARD: folds two running checksums over a fixed block of the program
 *      image at INTEGRITY_CHECKSUM_CODE_BLOCK and matches the four result bytes against four
 *      guard bytes baked in right after the block. A mismatch means the block was tampered.
 *   3. Splits the active player's timer minutes and seconds BCD bytes into hi/lo nibble tiles,
 *      laid up a single video column (one tile per tilemap row) with a spacer tile between the
 *      two digit groups, then blanks the source timer bytes it consumed.
 *   4. Scans a small block of anti-tamper flags. A wholly-clear block ends the routine; the
 *      first flag found set diverts into a second, tail integrity guard.
 *   5. TAIL INTEGRITY GUARD: sums bytes from the first set flag up to a sentinel and matches
 *      the two-byte result against its guard pair. A low-byte miss refuses to continue; a
 *      high-byte-only miss instead repaints the phase gauge and returns.
 *
 * LIVE-OUT: none — both dispatch callers reload every register before reading one, so no
 * register survives; the whole effect is in memory (the enqueued command word, the nibble
 * tiles written into video RAM, and the cleared timer source bytes).
 */

// The fixed magic numbers this handler is built around — the command word it emits, the shape
// of the two integrity checksums, and the geometry of the nibble-tile column.
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

  // Step 1 — emit the fixed display command. Its high byte (0x06) is a command class and its low
  // byte (0x09) the argument; the routine only appends the word to the display-command ring, and
  // the per-frame ring consumer acts on it later (or it is dropped silently if the ring is full).
  enqueueDisplayCommand(m, DISPLAY_CMD);

  // Step 2 — ENTRY INTEGRITY GUARD over the fixed program block at INTEGRITY_CHECKSUM_CODE_BLOCK
  // (0x2901). Two running sums are folded across CHECKSUM_LEN (0x5b) bytes:
  //   - sumHi:sumLo — a plain 16-bit sum of every byte in the block, carrying into the high byte
  //     whenever a byte-add overflows past 0xff;
  //   - evenHi:evenLo — a second 16-bit sum that folds in the running low byte ONLY at even
  //     source addresses, giving a position-sensitive companion signature that a byte swap or
  //     shift would disturb even if the plain sum happened to still match.
  // These are exactly the four signature bytes the ROM expects an intact copy of this block to
  // produce; they are matched below against the four guard bytes stored immediately after it.
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
  // The four expected signature bytes sit directly after the block, at block + length (0x295c).
  // Any of the four disagreeing means the guarded code was altered — impossible with an intact
  // ROM — so the handler refuses to go on rather than run on top of a tampered image.
  const guard = INTEGRITY_CHECKSUM_CODE_BLOCK + CHECKSUM_LEN;
  if (sumLo !== mem8[guard] || sumHi !== mem8[guard + 1]
      || evenLo !== mem8[guard + 2] || evenHi !== mem8[guard + 3]) {
    throw new Error("renderPlayTimerNibblesAndGuardChecksum: entry integrity checksum mismatch (unreachable with intact data)");
  }

  // Step 3 — render the active player's remaining time. ACTIVE_PLAYER (0x880d) selects whose
  // three-byte BCD play-timer to read: player 2's (PLAY_TIMER_BCD_P2) when it is nonzero, else
  // player 1's (PLAY_TIMER_BCD_P1). The +2 points at the high byte of the pair (the minutes),
  // and the loop below walks the source pointer downward from there to the seconds byte.
  //
  // Each source byte packs two BCD digits. Both are painted as tiles up the video column at
  // PLAY_TIMER_DIGIT_VRAM (0x862d): the high nibble first, then one row higher (ROW_STRIDE = 0x20
  // subtracted moves up exactly one tilemap row) the low nibble, then up another row. The two
  // passes differ only in the final micro-step, which is dictated by the fixed cell layout: the
  // minutes pass drops a SPACER_TILE (0x51) between the two digit groups and steps the source
  // pointer down to the seconds byte, while the seconds pass merely nudges the cursor back by one.
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

  // Step 4 — blank the timer source. Fill a run of three bytes with 0 starting where the source
  // pointer came to rest, clearing the play-timer BCD bytes the render just consumed; the visible
  // value now lives only in the tiles written above.
  fillByteRun(m, timer, 0, 3);

  // Step 5 — scan the anti-tamper flag block at INTEGRITY_FLAG_SCAN_BASE (0x89e7), FLAG_COUNT (7)
  // bytes long. In normal operation every flag is clear and there is nothing more to do, so the
  // handler returns right here. The first flag found set marks the start of a region to re-check
  // and diverts execution into the tail integrity guard below.
  let flag = INTEGRITY_FLAG_SCAN_BASE;
  let diverted = false;
  for (let i = 0; i < FLAG_COUNT; i++) {
    if (mem8[flag] !== 0) { diverted = true; break; }
    flag = u16(flag + 1);
  }
  if (!diverted) return;

  // Step 6 — TAIL INTEGRITY GUARD. Starting at the first set flag, sum bytes forward until the
  // TAIL_SENTINEL (0xc9) terminator is reached, seeding the 16-bit accumulator with
  // TAIL_SEED_HI:TAIL_SEED_LO (0xffe0) — the very value the nibble-render column stride left
  // behind, reused here as the checksum seed. The two-byte result is then matched against the
  // guard pair at TAIL_CHECKSUM_GUARD (0x7a0b / 0x7a0c):
  //   - a low-byte mismatch means the region was tampered — refuse to continue;
  //   - a high-byte-only mismatch instead diverts to renderGaugeAndSetPlayStateForPlayer (repaint
  //     the phase gauge and set play state) and returns.
  // With an intact image both bytes match and the handler falls through to a plain return.
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
