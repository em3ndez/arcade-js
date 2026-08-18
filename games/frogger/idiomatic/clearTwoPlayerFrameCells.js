// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearTwoPlayerFrameCells  —  ROM 0x2856  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   A narrow reset primitive that wipes the diver's shared frame-animation scratch — the busy latch and
 *   the four cursor/counter cells that pace and position the river "dive" animation — but only in a
 *   two-player game. These are exactly the five cells the dive copier copyDiveAnimFrame (0x281b) zeroes
 *   when a dive cycle finishes; this routine performs the same "re-seed from scratch" reset, just driven
 *   from a different occasion.
 *
 * WHERE IT SITS
 *   Dispatched from the tail of the frog-death animation driver driveFrogDeathAnimation — on the final
 *   phase of BOTH death variants (the mid-river / SECOND_BANK drowning branch and the normal-lane branch).
 *   Once a frog has finished dying, any dive/figure animation that was mid-flight must not carry its stale
 *   pacing state into the next frog, so the death tail clears it. mechanisms.md files this with the
 *   board-setup / player-lifecycle clear family (the two-player page-swap + hand-off machinery), which is
 *   why the wipe is fenced behind the two-player gate below: a one-player game (or attract) skips it.
 *
 * LIVE-OUT
 *   Memory only. It writes five RAM cells and nothing else — no register the caller reads, no return value.
 *   On any non-two-player frame it touches no memory at all.
 */
import { PLAY_FLAG, SPRITE_FRAME_BUSY_LATCH1, TWOPLAYER_FRAME_CELL_814E, TWOPLAYER_FRAME_CELL_8145, TWOPLAYER_FRAME_CELL_8146, TWOPLAYER_FRAME_CELL_8147 } from "./names.js";

// PLAY_FLAG (0x83fe) encodes the play mode: 0 = attract, 1 = one-player game, 2 = two-player game.
const TWO_PLAYER = 2;

export function clearTwoPlayerFrameCells(m) {
  const { mem8 } = m;

  // ── Gate: two-player games only ──────────────────────────────────────────────────────
  // Read the play-mode flag PLAY_FLAG (0x83fe) and bail unless it holds 2. In one-player play and in
  // attract this reset simply does not run — the ROM fences it behind the two-player path, so the routine
  // returns having touched no memory. Every other mode falls straight through here.
  if (mem8[PLAY_FLAG] !== TWO_PLAYER) return;

  // ── Clear the busy latch (the figure/dive interlock) ─────────────────────────────────
  // SPRITE_FRAME_BUSY_LATCH1 (0x814f) is the mutual interlock shared by the two-pair figure animator and
  // the dive-frame copier: while it is SET a dive cycle is armed, the figure animation holds off, and only
  // the dive copier advances. Zeroing it here forcibly declares "no dive in progress", re-enabling the
  // figure animation — the same effect the copier produces when it clears the latch at a cycle's end.
  mem8[SPRITE_FRAME_BUSY_LATCH1] = 0;

  // ── Clear the dive cursor + surface-timer cells ──────────────────────────────────────
  // The four cells below carry the in-flight dive animation's position and pacing. (Their names.js
  // TWOPLAYER_FRAME_CELL_* labels come from THIS routine's two-player gate; their real roles are the
  // dive-cycle cursor and surface-timer counter, documented per cell in mechanisms.md.)
  //   0x814e — dive-cycle cursor: byte index into the ROM frame table   (steps +2 per emitted frame)
  //   0x8145 — dive-cycle cursor: destination VRAM column offset        (steps +0x20 per emitted frame)
  //   0x8146 — surface-timer counter: reload period
  //   0x8147 — surface-timer counter: live countdown
  // Zeroing all four returns the dive to its unarmed, un-cursored start so the next arm re-seeds cleanly.
  // Order matches the ROM's store sequence at 0x2856 (latch first, then 0x814e, 0x8145, 0x8146, 0x8147).
  mem8[TWOPLAYER_FRAME_CELL_814E] = 0;
  mem8[TWOPLAYER_FRAME_CELL_8145] = 0;
  mem8[TWOPLAYER_FRAME_CELL_8146] = 0;
  mem8[TWOPLAYER_FRAME_CELL_8147] = 0;
}
