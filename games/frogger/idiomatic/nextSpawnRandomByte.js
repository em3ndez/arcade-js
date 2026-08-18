// SPDX-License-Identifier: GPL-3.0-only
/**
 * nextSpawnRandomByte  —  ROM 0x0AEE  ·  grounding: [seen,poked]
 *
 * WHAT IT IS
 *   One step of the spawn pseudo-random generator. Frogger does not draw its river/road traffic from a
 *   clock or a checksum — it pulls "random" bytes from a 32-cell lagged-XOR ring living in work RAM at
 *   SPAWN_RNG_RING_BASE (0x8400). Cell 0 of that ring is not data: it is a moving CURSOR. Every call
 *   here advances the cursor one notch, folds the cell it now points at together (by XOR) with a second
 *   cell a fixed lag ahead, writes the mixed byte back into the ring, and hands it out as this frame's
 *   random byte. The ring is seeded once at cold boot from a 32-byte ROM table (SPAWN_RING_INIT_SRC
 *   0x2eb1), so the stream is fully deterministic but statistically scrambled — a classic lagged
 *   generator, not a counter.
 *
 * WHERE IT SITS
 *   Called by the object-spawn arms — spawnSpriteObject (0x2c13) and spawnSpriteObjectArmA (0x2a6a).
 *   Each draws several bytes per spawn decision (to density-gate the spawn, pick a variant, and pick a
 *   launch direction), and every draw advances the ring as a side effect, so all spawn arms share one
 *   evolving generator state. Both arms are level-gated on LIVES_COUNT (0x83b7) >= 3; attract mode never
 *   dispatches this leaf, which is why its equivalence test drives it from a crafted entry rather than
 *   from live play.
 *
 * LIVE-OUT
 *   The ring in memory (the advanced cursor cell and the rewritten partner cell) AND register A, which
 *   carries the freshly mixed byte back to the caller. The ROM saves and restores HL/DE around the body,
 *   so those registers are NOT live-out and this register-free rewrite never touches them.
 */
import { SPAWN_RNG_RING_BASE } from "./names.js";

// The ring is 32 cells wide: cell 0 is the cursor, cells 1..31 hold the data bytes that get folded.
const RING_SIZE = 32;

// When decrementing the cursor underflows off cell 1 down to cell 0, it wraps up to the LAST index (31).
// Cell 0 is reserved for the cursor itself, so the cursor never rests there — it cycles endlessly through
// the 31 data cells.
const WRAP_TO = 31;

// The fold partner sits this many cells ahead of the cursor — a fixed lag. Pairing a moving cursor with a
// fixed-lag partner is what stretches the XOR stream into a long period instead of a plain toggle.
const FOLD_OFFSET = 13;

// When cursor+13 runs off the end of the ring it is folded back by subtracting RING_SIZE - 1 (31), NOT
// RING_SIZE (32). Subtracting 31 lands the partner in 1..31 and specifically SKIPS index 0 — so the fold
// can never pick the cursor/control cell as a data partner.
const FOLD_BACK = 31;

export function nextSpawnRandomByte(m) {
  const { regs, mem8 } = m;

  // ── Advance the cursor (ROM 0x0AF3: dec (0x8400)) ─────────────────────────────────────
  // The cursor byte lives at the base of the ring, SPAWN_RNG_RING_BASE (0x8400). Step it one cell
  // backward. If the decrement lands on 0 (the reserved control cell), wrap up to the top data index
  // (WRAP_TO = 31) so the cursor keeps circulating through data cells 1..31 and never parks on cell 0.
  // Write the new cursor back in place — it must persist to seed the next draw.
  let cursor = (mem8[SPAWN_RNG_RING_BASE] - 1) & 0xff;
  if (cursor === 0) cursor = WRAP_TO;
  mem8[SPAWN_RNG_RING_BASE] = cursor;

  // ── Locate the fold partner (ROM 0x0AFB-0x0B01: A = cursor + 0x0D, fold below 0x20) ────
  // The partner cell is FOLD_OFFSET (13) cells ahead of the cursor. If that runs off the end of the ring
  // (partner >= RING_SIZE), fold it back down by FOLD_BACK (31) so it re-enters the data range. The
  // result is guaranteed to be a data cell in 1..31 — never index 0 — for the reason noted on FOLD_BACK.
  let partner = (cursor + FOLD_OFFSET) & 0xff;
  if (partner >= RING_SIZE) partner -= FOLD_BACK;

  // ── Mix and store (ROM 0x0B04-0x0B06: (0x8400+partner) ^= (0x8400+cursor)) ─────────────
  // Fold the cursor's cell into the partner's cell by XOR, write the mixed byte back into the PARTNER
  // slot (so the ring's contents evolve from frame to frame), and return it in register A — the byte the
  // spawn arms consume as this frame's random draw.
  const value = mem8[SPAWN_RNG_RING_BASE + cursor] ^ mem8[SPAWN_RNG_RING_BASE + partner];
  mem8[SPAWN_RNG_RING_BASE + partner] = value;
  return (regs.a = value);
}
