// SPDX-License-Identifier: GPL-3.0-only
/**
 * addScoreAndAwardExtraLife  —  ROM 0x08e0  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The scoring core. Given a packed-BCD point delta (passed in the Z80's DE register), it adds those
 *   points to the ACTIVE player's on-screen score, grants the one-time 20000-point threshold bonus on
 *   the first frame the score reaches it, and keeps the running high score. Every point Frogger ever
 *   awards — a row of forward progress, a home bay, the end-of-board time bonus — flows through here.
 *
 * WHERE IT SITS
 *   Called with a delta by each of the point sources: scoreFrogRowProgress (0x1fd6) on a forward hop,
 *   the home-bay goal path (stampHomeGoalAndResetFrog / awardBonusPoints), and armScoreBonusStrip
 *   (0x08c5) cashing in the leftover time as the end-of-board bonus. It is gated off entirely while no
 *   game is in play, so attract-mode point events cannot disturb the score.
 *
 * NAMING NOTE
 *   Despite the name, the "extra life" awarded here is NOT a life. The threshold bonus bumps the active
 *   player's *time-remaining* byte and stamps a HUD tile — it extends the time bar; it does not add a
 *   frog. The true extra-life-per-board grant lives in awardExtraLife. The name is kept to match the
 *   established ROM-routine map (see mechanisms.md).
 *
 * LIVE-OUT
 *   Memory only. It writes the active score word, and on the threshold frame the award flag, the
 *   counter byte, one HUD tile cell and one command-ring slot; it always trails the high score. It
 *   returns nothing and leaves no register the caller reads.
 */
import { PLAY_FLAG, ACTIVE_PLAYER, PLAYER1_SCORE, PLAYER2_SCORE, PLAYER1_EXTRA_LIFE_AWARDED, PLAYER2_EXTRA_LIFE_AWARDED, TIME_REMAINING_P1, TIME_REMAINING_P2, loc_83cf, EXTRA_LIFE_SCORE_TARGET, HIGH_SCORE, EXTRA_LIFE_HUD_SLOT_TOP } from "./names.js";
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";
import { bcdAddByte } from "../../../core/bcd.js";

// One tilemap row is 0x20 (32) cells wide, so subtracting 0x20 from a VRAM address steps straight up
// one row within the HUD column.
const HUD_ROW_STEP = 0x20;

// Tile 0x4d is the bonus/extra-life marker glyph — the same tile renderTimeBar draws up the time column.
const BONUS_TILE = 0x4d;

// Command 0x07 on the shared sound/command ring is a "tile update" request (not a tone): it tells the
// display side to flush the HUD cell just stamped. enqueueSoundCommand pushes it onto the ring.
const TILE_UPDATE_CMD = 0x07;

export function addScoreAndAwardExtraLife(m, delta = m.regs.de) {
  const { mem8, mem16 } = m;

  // ── Gate: only score while a game is in play ─────────────────────────────────────────
  // PLAY_FLAG (0x83fe) is 0 during attract / game-over. Points must never accrue then, so bail at once
  // before touching any score cell.
  if (mem8[PLAY_FLAG] === 0) return;

  // ── Select the active player's score word ────────────────────────────────────────────
  // ACTIVE_PLAYER (0x83fd) holds 1 or 2. Each player owns a 16-bit little-endian packed-BCD score word:
  // PLAYER1_SCORE (0x83ed) or PLAYER2_SCORE (0x83eb). scoreLo is its low byte, scoreHi the high byte.
  const activePlayerIsP1 = mem8[ACTIVE_PLAYER] === 1;
  const scoreLo = activePlayerIsP1 ? PLAYER1_SCORE : PLAYER2_SCORE;
  const scoreHi = scoreLo + 1;

  // ── Add the delta in packed BCD, one byte at a time ──────────────────────────────────
  // The Z80 added each byte then ran `daa` to re-normalise the result to decimal; bcdAddByte
  // (core/bcd.js) reproduces that exactly, returning { value, carry }. Add the low bytes first, then
  // thread the decimal carry-out into the high-byte add — so 0x1990 + 0x0010 becomes 0x2000, not
  // 0x19a0.
  const lo = bcdAddByte(delta & 0xff, mem8[scoreLo]);
  mem8[scoreLo] = lo.value;
  const hi = bcdAddByte(delta >> 8, mem8[scoreHi], lo.carry);
  mem8[scoreHi] = hi.value;

  // Re-read the freshly written pair as one 16-bit value for the threshold and high-score compares.
  const score = mem16[scoreLo];

  // ── One-time threshold bonus at EXTRA_LIFE_SCORE_TARGET ──────────────────────────────
  // Each player has a one-shot award latch: PLAYER1_EXTRA_LIFE_AWARDED (0x83e7) /
  // PLAYER2_EXTRA_LIFE_AWARDED (0x83e8). On the first frame the score reaches the ROM target word
  // EXTRA_LIFE_SCORE_TARGET (0x2e08, value 0x2000 = 20000 displayed) with that latch still clear, pay
  // out the bonus exactly once.
  const awardCell = activePlayerIsP1 ? PLAYER1_EXTRA_LIFE_AWARDED : PLAYER2_EXTRA_LIFE_AWARDED;
  if (mem8[awardCell] === 0 && score >= mem16[EXTRA_LIFE_SCORE_TARGET]) {
    // loc_83cf (0x83cf) is a shared scratch/expiry byte the timer path reads; clearing it is part of
    // the ROM's award side-effect here.
    mem8[loc_83cf] = 0;

    // Latch the award so it can never fire again this game (initNewGameScoreAndTimers clears the pair
    // at new-game start).
    mem8[awardCell] = 1;

    // Bump the active player's counter — which is that player's TIME-REMAINING byte, TIME_REMAINING_P1
    // (0x83e5) / TIME_REMAINING_P2 (0x83e6). This is why the bonus lengthens the time bar: renderTimeBar
    // reads this very byte as the bar's length.
    const counterCell = activePlayerIsP1 ? TIME_REMAINING_P1 : TIME_REMAINING_P2;
    const count = (mem8[counterCell] + 1) & 0xff;
    mem8[counterCell] = count;

    // Stamp the bonus marker into the HUD column. Starting at the column top EXTRA_LIFE_HUD_SLOT_TOP
    // (0xabde), walk up one screen row (−0x20) per unit of the new counter value, then drop tile 0x4d
    // at the row reached — so the marker's height tracks the counter. The 8-bit wrap on the loop counter
    // matches the ROM exactly: a counter that wrapped to 0 walks the full 256 rows.
    let slot = EXTRA_LIFE_HUD_SLOT_TOP, rowsRemaining = count;
    do {
      slot = slot - HUD_ROW_STEP;
      rowsRemaining = (rowsRemaining - 1) & 0xff;
    } while (rowsRemaining !== 0);
    mem8[slot] = BONUS_TILE;

    // Queue a tile-update command on the ring so the display flushes the HUD cell just written.
    enqueueSoundCommand(m, TILE_UPDATE_CMD);
  }

  // ── Trail the running high score ─────────────────────────────────────────────────────
  // HIGH_SCORE (0x83ef) always shows the largest score seen; raise it whenever this score exceeds it.
  // (initNewGameScoreAndTimers deliberately never resets it, so it survives across games.)
  if (mem16[HIGH_SCORE] < score) mem16[HIGH_SCORE] = score;
}
