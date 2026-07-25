// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1d95 — commit A into the 0x6225 collection flag, then (off 25m) queue a
 * 3-frame priority sound.  ROM 0x1d95.
 *
 * A short `call z` target in the item-collection subsystem. Two sites reach it,
 * both immediately after a prize/item pickup marks the collection flags
 * 0x6340/0x6342/0x6225 = 1:
 *   - the post-jump LANDING reset entry_1c4f (ROM 0x1C70): `ld a,(0x6225) / dec a
 *     / call z,0x1d95` — fires when the flag is set, with A = 0 (the `dec` result);
 *   - the edge item-pickup sub_1a33 (ROM 0x1AB9): after erasing the picked item it
 *     does `ld a,(0x6216) / and a / call z,0x1d95` — fires when Mario is grounded,
 *     with A = 0 (the 0x6216 read).
 * So in play A is always 0 and the store CLEARS 0x6225; the routine is written to
 * store whatever A holds.
 *
 * After committing the flag it reads BOARD (0x6227): on 25m (BOARD == 1) it stops
 * — 25m plays no pickup sound. On every other board it queues priority tune 0x0D
 * for 3 frames (SND_PRIORITY overrides the background music while
 * SND_PRIORITY_FRAMES is nonzero). A LEAF: it calls nothing.
 *
 * NAME: kept the neutral loc_ — the mechanics are certain (store A into 0x6225;
 * off-25m queue tune 0x0D for 3 frames), but a meaningful English name would have
 * to commit to what 0x6225 is (ram.js examined it and DECLINED to name it — a
 * "prize/score-domain collection flag", evidence below the bar) and to what tune
 * 0x0D is, neither confirmed to the routine-name evidence bar. Its subsystem
 * siblings (loc_1e00/1e08/1e10/3e70) stayed neutral for the same reason; promoting
 * this one past them would overclaim. Promote once 0x6225 and tune 0x0D are pinned.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1d95.test.js.
 * GATE:     crafted-entry — attract dispatches 0x1d95 only on 25m (BOARD == 1,
 *           A = 0): the `ret z` no-sound arm (2 natural dispatches / 8000 frames,
 *           forced to ~12 via the entry_1c4f path). The sound arm (BOARD != 1) is
 *           never reached in attract, so it is exercised by an EXHAUSTIVE BOARD
 *           sweep (0..255) on a real captured entry — both arms — plus an A-sweep
 *           proving the store commits A faithfully. Teeth: wrong-sound (0x0C at
 *           0x608A), wrong board-gate (sound on 25m at 0x608A), wrong-store
 *           (0x6225 loses A).
 * LIVE-OUT: memory-only — 0x6225 and, off-25m, SND_PRIORITY (0x608A) /
 *           SND_PRIORITY_FRAMES (0x608B). The oracle's residual A/HL/F are dead:
 *           entry_1c4f's continuation entry_1da6 (reached via its `jp 0x1da6`)
 *           reloads HL and A from memory before use and reads no flag; the sub_1a33
 *           path just returns. SP/pc are the dropped stack model (the oracle's
 *           `ret` becomes the JS return).
 * NAMES:    BOARD (0x6227), SND_PRIORITY (0x608A), SND_PRIORITY_FRAMES (0x608B)
 *           from ram.js. 0x6225 kept hex — ram.js examined and left it unnamed.
 */
import { BOARD, SND_PRIORITY, SND_PRIORITY_FRAMES } from "../optimized/ram.js";

const COLLECTION_FLAG = 0x6225; // hex-kept: ram.js declined to name it (evidence below the bar)

export function loc_1d95(m) {
  const { regs, mem } = m;

  // ld (0x6225),a — commit A into the collection flag (both callers pass A = 0, so
  // in play this CLEARS it; the routine stores whatever A holds).
  mem.write8(COLLECTION_FLAG, regs.a & 0xff);

  // ld a,(0x6227) / dec a / ret z — on 25m (BOARD == 1) stop here: no pickup sound.
  if (mem.read8(BOARD) === 1) return;

  // Off 25m: queue priority tune 0x0D for 3 frames (overrides the BGM while the
  // frame counter is nonzero).
  mem.write8(SND_PRIORITY, 0x0d);
  mem.write8(SND_PRIORITY_FRAMES, 0x03);
}
