// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampScorePopupSprite — stamp a 4-byte sprite record, then cue a board-gated sound.  ROM 0x1e36.
 *
 * The shared tail of the sub_1dbd (EFFECT_STATE 0x6340) effect-sprite state machine. It
 * commits one hardware sprite record into POPUP_SPRITE (0x6A30) — inside SPRITE_BUFFER, at
 * +0x130 — from three caller-supplied bytes and a hard-coded attribute, then, ONLY on
 * the boards whose bit is set in the applicability mask 0x05 (bit0 = 25m, bit2 = 75m),
 * fires sound latch 0x6085.
 *
 *   record[0] (POPUP_SPRITE+0) = A       record[1] (POPUP_SPRITE+1) = B
 *   record[2] (POPUP_SPRITE+2) = 0x07 fixed  record[3] (POPUP_SPRITE+3) = C
 *
 * Reached two ways: stageAwardPopupAtHitObject `jp 0x1e36` (record bytes from an indirect param block)
 * and loc_1e28 fall-through (A = MARIO_X 0x6203, C = Mario Y + 0x14). The companion
 * state loc_1e4a blanks POPUP_SPRITE when the effect's timed hold (EFFECT_TIMER 0x6341)
 * expires, so POPUP_SPRITE is a transient sprite; 0x07 is its attribute byte and A/B/C its X/code/Y.
 *
 * The oracle's `ld a,0x05 / rst 0x30` is the idiomatic boardBitGate with A = 0x05: it
 * opens on 25m (BOARD 1) and 75m (BOARD 3), closes on 50m/100m — where the oracle's
 * `rst 0x30` caller-skip drops the 0x6085 write. That skip is the routine's ONLY
 * conditional; the four record bytes are stored unconditionally.
 *
 * NAME: kept the neutral loc_ — the memory mechanics are understood, but the specific
 * effect this sprite is and which sound 0x6085 plays (and why only 25m/75m) are not
 * confirmed to the routine-name evidence bar. Promote once corroborated.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1e36.test.js.
 * GATE:     crafted-entry — oracle-vs-idiomatic on real captured 25m dispatches
 *           (BOARD 1, gate open), a BOARD-exhaustive sweep (0..255) covering the
 *           50m/100m/other closed arms attract never reaches, and an A/B/C edge
 *           sweep, all on real captured bases. Two teeth: drop-the-gate and
 *           swap-the-record-order, each caught by its sweep.
 * LIVE-OUT: memory-only — writes POPUP_SPRITE (0x6A30..0x6A33) and (gate-open) 0x6085. The caller
 *           loc_197a issues its next `call` immediately without reading A/B/C/HL/DE/
 *           flags, so every register the oracle leaves (rotated A, B=0, HL) is dead;
 *           SP/pc are the stack idiom the boolean gate replaces and are not compared.
 * NAMES:    POPUP_SPRITE (0x6A30) — the score-popup sprite-record slot inside SPRITE_BUFFER
 *           (0x6900) — from names.js; boardBitGate (ROM 0x0030) reads BOARD (0x6227)
 *           internally. 0x6085 (SND_TRIGGER[5], sound latch) stays a local hex const —
 *           names.js deliberately leaves individual sound latches unnamed (the SND_TRIGGER[8]
 *           span is deferred to audio/README.md).
 */
import { boardBitGate } from "./boardBitGate.js"; // ROM 0x0030
import { POPUP_SPRITE } from "./names.js"; // 0x6A30 — score-popup sprite record inside SPRITE_BUFFER

const SPRITE_ATTR = 0x07;     // record byte +2, hard-coded
const BOARD_MASK = 0x05;      // rst-0x30 applicability mask: bit0 25m, bit2 75m
const SOUND_LATCH = 0x6085;   // SND_TRIGGER[5]; storing 3 asserts the sound for 3 frames

export function stampScorePopupSprite(m) {
  const { regs, mem } = m;

  // Commit the 4-byte sprite record {A, B, 0x07, C} into POPUP_SPRITE (unconditional).
  mem.write8(POPUP_SPRITE + 0, regs.a);
  mem.write8(POPUP_SPRITE + 1, regs.b);
  mem.write8(POPUP_SPRITE + 2, SPRITE_ATTR);
  mem.write8(POPUP_SPRITE + 3, regs.c);

  // rst 0x30 board gate: A = 0x05 selects the current board's mask bit (boardBitGate
  // reads regs.a). Closed on 50m/100m -> the oracle skips the caller's next write.
  regs.a = BOARD_MASK;
  if (!boardBitGate(m)) return; // gate closed -> no sound cue

  mem.write8(SOUND_LATCH, 0x03); // gate open (25m/75m) -> cue the sound (3-frame assert)
}
