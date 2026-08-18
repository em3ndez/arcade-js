// SPDX-License-Identifier: GPL-3.0-only
/**
 * scoreFrogRowProgress  —  ROM 0x1fd6  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The per-hop "you got a little further up the screen" scorer. Frogger pays the player a small reward
 *   each time the frog reaches a row it has never reached before on this life. This routine range-checks
 *   the frog's current row, decides whether it beats the furthest-row record, and — if so — advances the
 *   record and hands one point to the score adder.
 *
 * WHERE IT SITS
 *   Called from exactly one place: advanceFrogHopUp (ROM 0x1c0d), on the single frame an UP hop lands.
 *   Because only the UP-hop path reaches here, only forward (upward) progress ever scores — down, left, and
 *   right hops move the frog but never award a row-progress point. It runs once per completed upward hop,
 *   not every frame.
 *
 * LIVE-OUT
 *   Memory only. It updates the high-water mark cell and (on a scoring row) calls the score adder, which
 *   writes the score/extra-life cells. It returns nothing and leaves no register the caller reads.
 *
 * THE COORDINATE CONVENTION (important for reading every comparison below)
 *   FROG_Y (0x8047) is the frog's row in game space, where a SMALLER number is HIGHER on the screen: the
 *   golden-run capture watched it climb 0xE0 (bottom) down toward 0x40 (top) as the frog advanced. So
 *   "further up" / "a new record" means the current row is a SMALLER value than the recorded mark, and the
 *   mark FROG_FURTHEST_ROW (0x8269) holds the smallest (nearest-top) row seen so far this life.
 */
import { FROG_Y, FROG_FURTHEST_ROW } from "./names.js";
import { addScoreAndAwardExtraLife } from "./addScoreAndAwardExtraLife.js";

// The scored band, ROM 0x1fdb/0x1fde. Rows below 0x30 (top of screen / home area) and past 0xd0 (bottom)
// fall outside the band and score nothing. 0xd0 is the bottom edge of the band and gets special seeding
// (see below); 0x80 is the mid row and is a scoring exception (updates the mark but pays nothing).
const ROW_MIN = 0x30, ROW_MAX = 0xd0, ROW_MID = 0x80;

// Sentinel written into the mark on the very first band crossing (ROM 0x2000). The mark starts at 0 (its
// reset value from resetFrogObject), and 0 is SMALLER than every in-band row, so "furthest <= row" would
// be true forever and nothing would ever score. Seeding the mark to 0xe0 — a value BELOW the whole band,
// i.e. worse than any real row — turns that 0 sentinel into a proper "further back than anything" baseline
// so the very first row the frog reaches counts as progress.
const SEED_ABOVE_BAND = 0xe0;

// The reward, ROM 0x1fef (DE = 0x0001). It is a BCD 1 handed to the score adder, which surfaces as 10
// displayed points (Frogger scores in tens).
const PROGRESS_DELTA = 1;

export function scoreFrogRowProgress(m) {
  const { mem8 } = m;

  // ── Read the frog's current row ──────────────────────────────────────────────────────
  // FROG_Y (0x8047) is the frog's game-space row for this landed hop (ROM 0x1fd9).
  const row = mem8[FROG_Y];

  // ── Band gate: is the frog inside the scored region? ─────────────────────────────────
  // ROM 0x1fdb `ret c` rejects anything above the top edge (row < 0x30); ROM 0x1fe1 `ret nc` rejects
  // anything past the bottom edge (row > 0xd0). Only the band [0x30, 0xd0] is scored; outside it we are
  // done without touching memory.
  if (row < ROW_MIN || row > ROW_MAX) return;

  // ── First-crossing seed at the bottom edge ───────────────────────────────────────────
  // ROM 0x1ff8: when the frog is exactly on the bottom band edge (0xd0) AND the mark is still its initial
  // 0, seed the mark to 0xe0 so this very crossing can score (see SEED_ABOVE_BAND above). If the mark is
  // already nonzero the frog has been here before, so no seeding — the record comparison below stands.
  if (row === ROW_MAX && mem8[FROG_FURTHEST_ROW] === 0) mem8[FROG_FURTHEST_ROW] = SEED_ABOVE_BAND;

  // ── Record test: did the frog reach a row nearer the top than ever before? ────────────
  // Re-read FROG_FURTHEST_ROW (0x8269) AFTER any seed above (ROM 0x1fe2). A smaller row = higher up = a new
  // record. This single guard folds the oracle's two rejections: ROM 0x1fe6 `ret c` (mark < row, i.e. the
  // frog is lower than its record — no progress) and ROM 0x1fe7 `ret z` (mark == row, same row again).
  // Either way there is nothing to record and nothing to score.
  const furthest = mem8[FROG_FURTHEST_ROW];
  if (furthest <= row) return;

  // ── Advance the high-water mark ──────────────────────────────────────────────────────
  // New furthest row: stamp it into FROG_FURTHEST_ROW (0x8269) so future hops must beat THIS row (ROM
  // 0x1fe9). Note this happens even for the mid-row exception below, so the mid row still counts as
  // progress for record-keeping — it just doesn't pay.
  mem8[FROG_FURTHEST_ROW] = row;

  // ── Mid-row scoring exception ─────────────────────────────────────────────────────────
  // ROM 0x1ff1 `cp 0x80` / `ret z`: the exact mid-band row 0x80 advances the mark (done above) but awards
  // no point. Every other new-record row falls through to the score.
  if (row === ROW_MID) return;

  // ── Award the progress point ─────────────────────────────────────────────────────────
  // Hand a BCD 1 to addScoreAndAwardExtraLife (ROM 0x08e0), which adds it to the score and grants an extra
  // life if a bonus threshold is crossed. In the ROM this is a plain `call` bracketed by push/pop of HL
  // (ROM 0x1ff2..0x1ff7) — bookkeeping the idiomatic call has no need of.
  addScoreAndAwardExtraLife(m, PROGRESS_DELTA);
}
