// SPDX-License-Identifier: GPL-3.0-only
/**
 * enqueueLaneScrollSyncedCommand  —  ROM 0x2906  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The per-frame trigger that queues the "frog-on-log edge blit" — tile command 0xD0 — onto the sound
 *   CPU's command ring, but only on a frame where the lane's scroll counter is back at phase 0. Command
 *   0xD0 is a tile-update the sound CPU redraws (the log/turtle edge the frog rides); firing it only when
 *   the lane scroll is aligned means the redrawn edge lines up with the lane's current pixel offset instead
 *   of landing mid-slide.
 *
 *   NOTE ON AN OLD READING: an earlier pass read the two data gates below as *frog* state — a "blit busy"
 *   flag and a frog-on-log phase index. Grounding overturned that: both gates read LANE data (the per-board
 *   lane-control byte and the lane's own scroll counter), not frog state. The command *payload* 0xD0 is
 *   still the frog-on-log edge blit; only the *gate* is about lane-scroll timing.
 *
 * WHERE IT SITS
 *   One of the in-play collision/animation sub-engines fanned out once per frame by
 *   orchestrateCollisionsAndFrogInput (0x1a55) — the "lane-scroll sound" arm. It is inert on the vast
 *   majority of frames (all three gates below must pass), so most calls fall straight through a `return`
 *   without touching memory.
 *
 * LIVE-OUT
 *   Memory only, and only via enqueueSoundCommand (0x0018): on a passing frame it bumps the ring head count
 *   SOUND_QUEUE_COUNT (0x8300) and stores 0xD0 in the new slot. It returns nothing and leaves no register
 *   the caller reads.
 */
import { PLAY_FLAG, LANE_CONTROL_SPEED_7, LANE_RUN_SCROLL_POS } from "./names.js";
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";

// The lane-control byte's accepted window is the half-open interval [PHASE_LO, PHASE_HI): at or above 0x02
// and STRICTLY BELOW 0x0f (i.e. 0x02..0x0e inclusive). PHASE_HI is the exclusive upper bound, not the top
// valid value.
const PHASE_HI = 0x0f;         // phase must be below this ...
const PHASE_LO = 0x02;         // ... and at or above this
// Tile command 0xD0 = the frog-on-log edge blit (mechanisms.md, "Sound: the command ring"). It rides the
// same ring as audio tones; the sound CPU reads a high-range code like this as a tile update, not a note.
const BLIT_CMD = 0xd0;

export function enqueueLaneScrollSyncedCommand(m) {
  const { mem8 } = m;

  // ── Gate 1: is a game actually in play? ──────────────────────────────────────────────
  // PLAY_FLAG (0x83fe) is 0 in attract/demo and holds the player count (1 or 2) during a game. The edge
  // blit is a live-gameplay effect, so a clear flag drops out at once. (enqueueSoundCommand repeats this
  // same PLAY_FLAG==0 check and would drop the command anyway — this is a cheap early-out, not the only
  // guard.)
  if (mem8[PLAY_FLAG] === 0) return;

  // ── Gate 2: is the lane-control byte inside the animating window? ─────────────────────
  // LANE_CONTROL_SPEED_7 (0x81a2) is object-7's control byte in the 11-byte per-board lane block
  // (0x819b..0x81a5): low nibble = lane speed, bit4 = sub-rate flag. This routine tests the whole byte as a
  // gate value and keeps only the [0x02,0x0e] window. GROUNDED: on the observed board this byte sat fixed
  // at 0x13 and never animated — and 0x13 is outside the window (0x13 >= PHASE_HI), so the enqueue was not
  // observed to fire in grounded play. The window still guards the general case.
  const phase = mem8[LANE_CONTROL_SPEED_7];
  if (phase >= PHASE_HI || phase < PHASE_LO) return;

  // ── Gate 3: is the lane scroll aligned to phase 0? ───────────────────────────────────
  // LANE_RUN_SCROLL_POS (0x8140) is byte 0 of the 9-byte lane-run header (0x813f); the lane mover ramps and
  // wraps it every frame. Enqueuing only when it reads 0 lands the blit on a scroll-aligned frame so the
  // redrawn edge matches the lane's pixel offset. (This is a scroll-phase==0 gate, NOT a "blit busy" flag —
  // see the note in the header.)
  if (mem8[LANE_RUN_SCROLL_POS] !== 0) return;

  // ── All three gates passed → queue the edge blit ─────────────────────────────────────
  // Push 0xD0 onto the sound/tile command ring through the shared enqueueSoundCommand primitive (0x0018),
  // which advances SOUND_QUEUE_COUNT (0x8300) and stores the byte in the new slot. dequeueSoundCommand
  // drains and issues it to the sound CPU on a later in-play frame.
  enqueueSoundCommand(m, BLIT_CMD);
}
