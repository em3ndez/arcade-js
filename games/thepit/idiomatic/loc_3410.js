// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_3410 — one of four sibling table searches the object-movement dispatcher
 * uses to decide whether a move in a given direction is allowed.  ROM 0x3410.
 *
 * It scans a 32-byte row of the table that begins at 0x35fe for a single key
 * byte, and reports whether the key was present. The caller (the movement
 * dispatcher at 0x319d) tests that answer to pick which velocity-preset handler
 * to tail-jump into — a "can the object step this way?" gate.
 *
 *   - The row is chosen by an index byte at 0x808d: the row starts that many
 *     bytes past the table base. (In attract the index is 0, but the offset is
 *     faithful — a crafted non-zero index is exercised in the gate.)
 *   - The key is the byte just past the object's current display-cell pointer
 *     held at 0x8089 — i.e. the neighbouring tile code. The "+1" is load-bearing:
 *     without it the current cell, not the neighbour, would be tested.
 *   - The scan walks at most 32 bytes and stops at the first match; if the whole
 *     row is exhausted with no match the answer is "not allowed".
 *
 * The name stays neutral: the searched bytes read as tile codes and the tables as
 * per-direction allowed-tile sets, but the three inputs (0x808d, 0x8089, the
 * 0x35fe table) are all still unnamed in the mechanism map, so the role has not
 * reached the confidence an English name would claim.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3410.test.js.
 * GATE:     crafted-entry + captured dispatches; reached in attract via the
 *           movement dispatch loc_319d — 264 real dispatches, both the found (218)
 *           and not-found (46) arms hit naturally; crafted entries add non-zero
 *           row indices and pointer-neighbour keys.
 * LIVE-OUT: the match result the caller branches on (the Z flag). HL — the cursor
 *           one past the matched byte — is reproduced to match the oracle, but no
 *           caller reads it: all six call sites branch on the flag alone.
 * NAMES:    none from ram.js — 0x808d (row index), 0x8089 (display-cell pointer),
 *           and the 0x35fe ROM table base are all still hex (unnamed).
 */

import { F_Z } from "../../../core/cpu/z80.js";

export function loc_3410(m) {
  const { regs, mem } = m;

  // Which 32-byte row to scan, and where in ROM it starts.
  const rowIndex = mem.read8(0x808d);
  const rowBase = 0x35fe + rowIndex;

  // The key: the tile code one cell past the object's current display cell.
  const cellPtr = mem.read16(0x8089);
  const key = mem.read8(cellPtr + 1);

  // Walk up to 32 bytes, stopping at the first match. The cursor lands one byte
  // past the matched cell on a hit, or at the row's end when nothing matched —
  // exactly where the scan leaves it.
  let cursor = rowBase;
  let matched = false;
  for (let i = 0; i < 32; i++) {
    const hit = mem.read8(cursor) === key;
    cursor += 1;
    if (hit) {
      matched = true;
      break;
    }
  }

  // Publish what the caller reads: the found/not-found answer it branches on,
  // plus the cursor position (reproduced to match the oracle).
  regs.hl = cursor;
  regs.f = matched ? regs.f | F_Z : regs.f & ~F_Z;
}
