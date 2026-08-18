// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveScoreDisplayCountdown  —  ROM 0x0870  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The end-of-board bonus-countdown driver. When a board is cleared the game shows the player's
 *   remaining time-bonus draining away tile-by-tile down a vertical bar while a BCD number ticks down;
 *   this routine runs one frame of that animation. It is the "count the leftover time into your score"
 *   ceremony you see between boards.
 *
 * WHERE IT SITS
 *   Called once per frame from the in-play service cascade (serviceVblankNmi), but only after the
 *   board-complete reveal timers have all drained — so it is the last stage of the board-clear sequence.
 *   It idles (the two guards below) whenever the demo/attract flag or the hold flag is set, so most of
 *   the time the call falls straight through. The first live frame lays out the display field once
 *   (initDisplayFieldOnce, ROM 0x0aba), which seeds the two counters this routine then walks down.
 *
 * THE TWO COUNTERS
 *   initDisplayFieldOnce seeds a 16-bit cell at loc_83dc (0x83dc) with SCROLL_STATE_INIT = 0x3c20, and a
 *   separate display byte loc_83de (0x83de) with 0x60. Read as two bytes, that 16-bit cell is:
 *     - low byte  loc_83dc (0x83dc)               = the per-step PACE (0x20 = 32 frames between steps)
 *     - high byte SCORE_DISPLAY_COUNTER_HI (0x83dd) = the STEP COUNT (0x3c = 60 steps to drain the bar)
 *   loc_83de (0x83de) is the visible bonus number, BCD-decremented one step at a time.
 *
 * LIVE-OUT
 *   Memory only. It writes the counters, one bar-tile VRAM cell per step, the sound ring, and (on the
 *   final step) the hold flag via the end tail. It returns nothing the caller reads.
 */
import {
  FROG_STATE_DEMO_FLAG, HOLD_FLAG, COUNTDOWN_EXPIRY_FLAG, SCORE_DISPLAY_ARM_SELECT, loc_83dc,
  SCORE_DISPLAY_COUNTER_HI, loc_83de, loc_83e0, OBJRAM_COL3F_ATTR_SHADOW,
  LAYOUT_SETUP_COLUMN_VRAM, NO_MORE_FROGS_COLUMN_VRAM, LAYOUT_SETUP_STRIP_SRC,
} from "./names.js";
import { initDisplayFieldOnce } from "./initDisplayFieldOnce.js";
import { blitEndStripAndSetHold } from "./blitEndStripAndSetHold.js";
import { copyRunUpTileColumn } from "./copyRunUpTileColumn.js";
import { writePackedBcdByte } from "./writePackedBcdByte.js";
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";
import { addScoreAndAwardExtraLife } from "./addScoreAndAwardExtraLife.js";
import { bcdSubByte } from "../../../core/bcd.js";

// Value reloaded into the pace low byte (loc_83dc, 0x83dc) after each step drains it: 0x20 = 32 frames
// per step, matching the ROM's 0x3c20 seed. This paces the visible bar so it drains over ~2 seconds.
const COUNTDOWN_RELOAD = 0x20;

// The bar is drawn down the VRAM column initDisplayFieldOnce filled with tile 12 (LAYOUT_SETUP_COLUMN_VRAM
// 0xa8df); each step overwrites one cell of that column with a partial-fill tile. Aliased for readability.
const BAR_BASE = LAYOUT_SETUP_COLUMN_VRAM;

// Sound-ring commands (enqueueSoundCommand). 0x06 is the one-shot "countdown starting" tone latched on the
// first live frame; 0x05 is the "time running low" warning fired when the bonus number reaches BCD 10.
const SOUND_COUNTDOWN_START = 0x06;
const SOUND_COUNTDOWN_WARNING = 0x05;

// The warning fires exactly when the BCD display byte (loc_83de) steps down to BCD 0x10 (= decimal 10).
const WARNING_BCD_THRESHOLD = 0x10;

export function driveScoreDisplayCountdown(m) {
  const { mem8 } = m;

  // ── Guard 1: demo / attract ──────────────────────────────────────────────────────────
  // FROG_STATE_DEMO_FLAG (0x83cd) is set during the attract demo and the board-complete re-arm. The
  // bonus countdown is a real-play ceremony, so it must stay inert whenever this flag is up.
  if (mem8[FROG_STATE_DEMO_FLAG] !== 0) return;

  // ── Guard 2: hold ────────────────────────────────────────────────────────────────────
  // HOLD_FLAG (0x8004) is the shared "freeze gameplay" latch. The end tail (below) raises it once the
  // bar has fully drained, which is what stops this driver from running again after it finishes.
  if (mem8[HOLD_FLAG] !== 0) return;

  // ── First live frame: latch the start tone ───────────────────────────────────────────
  // COUNTDOWN_EXPIRY_FLAG (0x83ae) starts at 0 and is set here so the "countdown starting" sound plays
  // exactly once, on the frame the ceremony begins. Every later frame sees it set and skips the sound.
  if (mem8[COUNTDOWN_EXPIRY_FLAG] === 0) {
    mem8[COUNTDOWN_EXPIRY_FLAG] = 1;
    enqueueSoundCommand(m, SOUND_COUNTDOWN_START);
  }

  // ── Lay out the display field (once) ─────────────────────────────────────────────────
  // initDisplayFieldOnce (ROM 0x0aba) is self-guarded by loc_842d (0x842d): the first call paints the
  // field strips and seeds both counters (loc_83dc = 0x3c20, loc_83de = 0x60); later calls return at
  // once. So this line is a no-op after the first frame but establishes the counters we walk below.
  initDisplayFieldOnce(m);

  // ── Bonus-strip arm branch ───────────────────────────────────────────────────────────
  // SCORE_DISPLAY_ARM_SELECT (0x83df) non-zero routes the whole ceremony into the one-shot bonus arm
  // (armScoreBonusStrip): rather than draining the bar tile-by-tile, it cashes the remaining bonus into
  // the score in a single pass. This is the tail-call for the "skip the animation" configuration.
  if (mem8[SCORE_DISPLAY_ARM_SELECT] !== 0) return armScoreBonusStrip(m);

  // ── Pace divider: one step every COUNTDOWN_RELOAD frames ──────────────────────────────
  // The pace low byte loc_83dc (0x83dc) counts down one per frame. On any frame it is still non-zero we
  // just store the decrement and wait — the bar advances only on the frame it wraps to 0, at which point
  // we reload it and fall through to take a single step. (Reads/writes only the low byte of the 16-bit
  // cell; the high byte SCORE_DISPLAY_COUNTER_HI is the step count, handled next.)
  const paceLeft = (mem8[loc_83dc] - 1) & 0xff;
  mem8[loc_83dc] = paceLeft;
  if (paceLeft !== 0) return;
  mem8[loc_83dc] = COUNTDOWN_RELOAD;

  // ── End of the bar → the no-more-frogs tail ──────────────────────────────────────────
  // SCORE_DISPLAY_COUNTER_HI (0x83dd) is the step count (seeded 0x3c = 60). When it has reached 0 the
  // bar is fully drained: hand off to blitEndStripAndSetHold (ROM 0x085b), which draws the closing
  // strips up NO_MORE_FROGS_COLUMN_VRAM (0xaa51) and raises HOLD_FLAG (0x8004) to stop this driver.
  const stepCount = mem8[SCORE_DISPLAY_COUNTER_HI];
  if (stepCount === 0) return blitEndStripAndSetHold(m);
  mem8[SCORE_DISPLAY_COUNTER_HI] = stepCount - 1;

  // ── Advance the visible bonus number (BCD) ───────────────────────────────────────────
  // loc_83de (0x83de) is the on-screen bonus figure, stored as packed BCD; bcdSubByte decrements it by
  // one in BCD (so 0x20 -> 0x19, not 0x1f). This is the number the player watches tick down.
  const bonusBcd = bcdSubByte(mem8[loc_83de], 1).value;
  mem8[loc_83de] = bonusBcd;

  // When the bonus number crosses BCD 10, fire the low-time warning tone and clear the col-0x3f
  // attribute shadow OBJRAM_COL3F_ATTR_SHADOW (0x803f) — a display-attribute write that changes how the
  // remaining field renders for the final stretch of the countdown.
  if (bonusBcd === WARNING_BCD_THRESHOLD) {
    enqueueSoundCommand(m, SOUND_COUNTDOWN_WARNING);
    mem8[OBJRAM_COL3F_ATTR_SHADOW] = 0;
  }

  // ── Animate one cell of the draining bar ─────────────────────────────────────────────
  return stepScoreBarTile(m);
}

/**
 * stepScoreBarTile — the bar-animation step of driveScoreDisplayCountdown (part of ROM 0x0870).
 *
 * Picks one cell of the vertical bar from the current step count and stamps a partial-fill tile into it,
 * so the bar visibly shrinks by one increment per step. The cell offset is derived exactly as the ROM
 * does — a Z80 RLCA-style byte rotate of the step count's top six bits, then doubled for the bar's
 * two-byte cell stride — so it is intentionally NOT a plain (count >> 2) * stride; keep the rotate as-is.
 */
function stepScoreBarTile(m) {
  const { mem8 } = m;

  // The step count SCORE_DISPLAY_COUNTER_HI (0x83dd) selects both the bar cell and how full it is:
  //   - its low two bits pick the partial-fill amount (0..3),
  //   - its top six bits pick which cell of the bar to touch.
  const stepCount = mem8[SCORE_DISPLAY_COUNTER_HI];
  const fillBits = stepCount & 0x03;

  // Rotate the top-six-bits value left by two (Z80 RLCA twice: bits wrap around the byte), then double it
  // for the bar's two-byte-per-cell stride, giving the offset of this step's cell from BAR_BASE (0xa8df).
  let cellBits = stepCount & 0xfc;
  cellBits = ((cellBits << 2) | (cellBits >> 6)) & 0xff; // rotate left by two (RLCA x2)
  const cell = BAR_BASE + (cellBits + cellBits);

  // Stamp the partial-fill tile: 0x10 is the full-bar tile, and each of the four low-bit values steps it
  // down (0x10, 0x0f, 0x0e, 0x0d) so the cell empties in four sub-increments as the count passes through.
  mem8[cell] = 0x10 - fillBits;
}

/**
 * armScoreBonusStrip — the bonus-strip arm  —  ROM 0x08c5  ·  grounding: [code]
 *
 * The "cash it in at once" path: instead of draining the bar tile-by-tile, it prints the leftover bonus
 * and adds it straight to the score. Reached two ways — as the SCORE_DISPLAY_ARM_SELECT (0x83df) branch
 * of the driver above, and as a standalone call from the home-goal reset path. Self-guarded so the payout
 * happens exactly once. LIVE-OUT: memory only.
 */
export function armScoreBonusStrip(m) {
  const { mem8 } = m;

  // ── One-shot guard ───────────────────────────────────────────────────────────────────
  // loc_83e0 (0x83e0) is cleared by initDisplayFieldOnce and set here on the first call, so the strip is
  // drawn and the bonus is paid exactly once; a re-entry after it is set returns without doing anything.
  if (mem8[loc_83e0] !== 0) return;
  mem8[loc_83e0] = 1;

  // ── Draw the bonus strip ─────────────────────────────────────────────────────────────
  // Blit the 5-tile ROM strip LAYOUT_SETUP_STRIP_SRC (0x2f6e) up the VRAM column
  // NO_MORE_FROGS_COLUMN_VRAM (0xaa51) — the same column the end tail uses — via copyRunUpTileColumn.
  copyRunUpTileColumn(m, NO_MORE_FROGS_COLUMN_VRAM, LAYOUT_SETUP_STRIP_SRC, 0x05);

  // ── Print the remaining bonus, then bank it ──────────────────────────────────────────
  // loc_83de (0x83de) is the leftover bonus figure. writePackedBcdByte prints it as two BCD digits on
  // screen, and addScoreAndAwardExtraLife adds that same figure to the player's score (awarding an extra
  // life if the score crosses the threshold) — the end-of-board time-bonus payout.
  const bonusBcd = mem8[loc_83de];
  writePackedBcdByte(m, bonusBcd);

  return addScoreAndAwardExtraLife(m, bonusBcd);
}
