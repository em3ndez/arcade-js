// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearSpriteColumns — zero the X byte of four fixed groups of sprite records.  ROM 0x30bd.
 *
 * A composition routine: it makes four back-to-back calls to clearStridedBytes
 * (ROM 0x30e4), each zeroing one run of bytes at stride 4 inside the 0x6900 sprite
 * shadow buffer. Every target address is on a 4-byte record boundary, so each run
 * blanks field +0 — the X coordinate — of a consecutive group of sprite records,
 * parking those sprites at the left edge. The four groups are disjoint and fixed:
 *
 *   SPRITE_BUFFER+0x50 (0x6950), 2 records   — records 20-21
 *   SPRITE_BUFFER+0x80 (0x6980), 10 records  — records 32-41
 *   SPRITE_BUFFER+0xb8 (0x69b8), 11 records  — records 46-56
 *   SPRITE_BUFFER+0x10c (0x6a0c), 5 records  — records 67-71   (via a TAIL JUMP)
 *
 * 28 records' X byte in all. CALLERS — corrected (pass 13; the old header said "during
 * board/how-high setup", which is wrong about the first caller):
 *   - beginMarioDeathAnimation (ROM 0x128B, the oracle's entry_128b) — the SEED of Mario's
 *     DEATH ANIMATION, not a board build. It calls this routine and then, at ROM 0x12A8,
 *     stores 3 into SND_IRQ_TRIGGER (0x6088) — the I8035 interrupt line at 0x7D80, which is
 *     MAME's "dead" line (dkong.cpp:202) and whose SOLE writer in the whole ROM is that one
 *     instruction (games/dkong/audio/README.md: 3 rises in 90 s, one per life). So the
 *     sprite groups are being cleared as Mario's death begins.
 *   - dispatchBoardClearedInterlude (the L2 board-advance dispatcher) — the other caller, unchanged.
 * CONFIDENT: the mechanism (four fixed stride-4 zero-fills) and that every target lies
 * in SPRITE_BUFFER at a record's field +0. INFERRED: the visual intent (hiding those
 * sprite groups) — the record identities and scene are not separately pinned here, and
 * pass 13 ran `-video none`, so nothing on screen was observed.
 *
 * The fourth call corresponds to the oracle's `jp 0x30e4` TAIL JUMP: it pushes no
 * return, so the callee's `ret` returns to clearSpriteColumns' OWN caller. In the
 * cycle-free model there is no stack to splice — the four calls are plain JS calls and
 * the single return is the function returning; the equivalence harness models the one
 * net Z80 `ret` with a single m.ret().
 *
 * Memory-equivalent to the frozen oracle — equivalence-30bd.test.js.
 * GATE:     crafted-entry — real captured attract dispatches (reached via entry_128b, i.e.
 *           when the attract demo's own Mario dies), plus sentinel-page crafted entries
 *           that pin the exact 28-byte cleared set, plus a crafted return-address entry
 *           for the unreached dispatchBoardClearedInterlude caller arm.
 *           Not exhaustive (the input is the buffer's prior contents × the caller's
 *           stack). Teeth: a dropped-tail-run twin and a short-third-run twin.
 * LIVE-OUT: memory-only — the 28 zeroed sprite-buffer bytes. Both callers overwrite A
 *           immediately after the call (entry_128b `ld a,0x03` @0x12a6, dispatchBoardClearedInterlude
 *           `ld a,(0x6227)` @0x1618) and read neither HL nor B, so A/HL/B (which the
 *           tail callee leaves as 0x20 / 0x6a20 / 0x00) are dead, as are flags. The
 *           routine reproduces them anyway via clearStridedBytes, but they are outside
 *           the gated contract, which is RAM + pc + SP.
 * NAMES:    SPRITE_BUFFER (0x6900) from ram.js — every target is an offset into it.
 *           0x30bd/0x30e4 stay hex, in this header only.
 */

import { clearStridedBytes } from "./clearStridedBytes.js";
import { SPRITE_BUFFER } from "./ram.js";

export function clearSpriteColumns(m) {
  const { regs } = m;

  // Each run sets HL (start) and B (record count), then zeroes B bytes at stride 4.
  // clearStridedBytes preserves H, but we reload the full HL each time for clarity.
  regs.hl = SPRITE_BUFFER + 0x50; // 0x6950 — records 20-21
  regs.b = 0x02;
  clearStridedBytes(m);

  regs.hl = SPRITE_BUFFER + 0x80; // 0x6980 — records 32-41
  regs.b = 0x0a;
  clearStridedBytes(m);

  regs.hl = SPRITE_BUFFER + 0xb8; // 0x69b8 — records 46-56
  regs.b = 0x0b;
  clearStridedBytes(m);

  regs.hl = SPRITE_BUFFER + 0x10c; // 0x6a0c — records 67-71 (the tail jump)
  regs.b = 0x05;
  clearStridedBytes(m);
}
