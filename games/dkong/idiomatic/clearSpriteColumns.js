// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearSpriteColumns — zero the X byte of four fixed groups of sprite records.
 *
 * A composition routine: it makes four back-to-back calls to the strided clear primitive,
 * each zeroing one run of bytes at stride 4 inside the sprite shadow buffer. Every target
 * address is on a 4-byte record boundary, so each run blanks field +0 — the X coordinate —
 * of a consecutive group of sprite records, parking those sprites at the left edge. The four
 * groups are disjoint and fixed:
 *
 *   SPRITE_BUFFER+0x50,  2 records   — records 20-21
 *   SPRITE_BUFFER+0x80,  10 records  — records 32-41
 *   SPRITE_BUFFER+0xb8,  11 records  — records 46-56
 *   SPRITE_BUFFER+0x10c, 5 records   — records 67-71   (via a TAIL JUMP)
 *
 * 28 records' X byte in all. It runs at two moments in play: as Mario's death animation is
 * seeded, and from the board-advance interlude once a board is cleared.
 *
 * CONFIDENT: the mechanism — four fixed stride-4 zero-fills, every target inside
 * SPRITE_BUFFER at a record's field +0. INFERRED: the visual intent, hiding those sprite
 * groups; the record identities and the scene are not pinned here and nothing on screen was
 * observed to confirm them.
 *
 * The fourth call is a TAIL JUMP in the hardware: it pushes no return, so the callee's return
 * goes to this routine's OWN caller. There is no stack to splice here — the four calls are
 * plain JS calls and the single return is this function returning.
 *
 * LIVE-OUT: memory-only — the 28 zeroed sprite-buffer bytes. Both callers overwrite the
 * accumulator immediately after the call and read neither HL nor B, so the registers the
 * clear primitive leaves behind are dead, as are the flags.
 */

import { clearStridedBytes } from "./clearStridedBytes.js";
import { SPRITE_BUFFER } from "./names.js";

export function clearSpriteColumns(m) {
  const { regs } = m;

  // Each run sets HL (start) and B (record count), then zeroes B bytes at stride 4. The
  // clear preserves the pointer's high byte, but the full HL is reloaded each time anyway.
  regs.hl = SPRITE_BUFFER + 0x50; // records 20-21
  regs.b = 0x02;
  clearStridedBytes(m);

  regs.hl = SPRITE_BUFFER + 0x80; // records 32-41
  regs.b = 0x0a;
  clearStridedBytes(m);

  regs.hl = SPRITE_BUFFER + 0xb8; // records 46-56
  regs.b = 0x0b;
  clearStridedBytes(m);

  regs.hl = SPRITE_BUFFER + 0x10c; // records 67-71 (the tail jump)
  regs.b = 0x05;
  clearStridedBytes(m);
}
