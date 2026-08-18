// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceAnimationFrameBuffer  —  ROM 0x1802  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The stepper that re-programs the 11-byte block at ANIM_FRAME_BUFFER (0x819b) on a countdown clock,
 *   cycling it through a ring of ROM presets. That block is not just an animation scratch buffer: those
 *   same eleven bytes (0x819b..0x81a5) ARE the per-board lane-control table that the lane movers read —
 *   each byte's low nibble is a lane's pixel speed and bit 4 is its sub-rate flag (see mechanisms.md:
 *   advanceScrollLaneObjects / moveLaneObjectsAndCarryFrog at 0x819b + i). So what looks like a generic
 *   "advance the animation frame" is really the mechanism that swaps the whole river/road lane-timing
 *   profile every ~21 frames, giving the traffic its shifting, breathing cadence. (The low nibble of the
 *   same block also seeds the diver's surface pacing.)
 *
 * WHERE IT SITS
 *   Runs once per in-play frame as part of the world step — dispatched from the vblank/NMI in-game
 *   branch (serviceVblankNmi, ROM 0x01f5/0x011c) and from the in-play frame update, right alongside
 *   advanceScrollLaneObjects (0x2005) which then consumes the lane-control bytes this routine installs.
 *   Most frames it does nothing but tick a timer, so it is cheap; it only touches the buffer once every
 *   TIMER_RELOAD frames.
 *
 * LIVE-OUT
 *   Memory only. It writes the frame timer, the frame index, and (on a copy pass) eleven buffer bytes.
 *   It returns nothing and leaves no register the caller reads.
 */
import { SPRITE_FRAME_BUSY_LATCH1, SPRITE_FRAME_BUSY_LATCH2, ANIM_FRAME_INDEX, ANIM_FRAME_TIMER, ANIM_FRAME_SRC_PTR_TABLE, ANIM_FRAME_BUFFER } from "./names.js";

// Frames between preset swaps. When the countdown hits 0 it is reloaded with this value (0x15 in the
// ROM) into ANIM_FRAME_TIMER (0x81b4), so one new preset lands in the buffer roughly every 21 frames.
const TIMER_RELOAD = 21;

// Number of entries in the ROM pointer table ANIM_FRAME_SRC_PTR_TABLE (0x1841). The ring index runs
// 0..9 and wraps the instant it would reach 10 (the ROM's `sub 0x0a`), so this is the wrap modulus.
const TABLE_LEN = 10;

// Bytes copied per preset. Exactly the width of the ANIM_FRAME_BUFFER lane-control block
// (0x819b..0x81a5), i.e. one control byte for each of the eleven lane objects (the ROM's LDIR of 0x0b).
const FRAME_BYTES = 11;

export function advanceAnimationFrameBuffer(m) {
  const { mem8, mem16 } = m;

  // ── Busy-latch gates: don't touch the buffer while another owner holds it ───────────────
  // The buffer at 0x819b is shared. While the diver-figure animation is mid-cycle it raises
  // SPRITE_FRAME_BUSY_LATCH1 (0x814f) and reads the buffer's low nibble to pace itself (armTwoPairFigureFrame,
  // copyDiveAnimFrame); SPRITE_FRAME_BUSY_LATCH2 (0x815b) is a second, independent busy hold. If either is
  // non-zero this routine must yield untouched, or it would overwrite the lane-control block out from under
  // whoever is currently using it.
  if (mem8[SPRITE_FRAME_BUSY_LATCH1] !== 0) return;
  if (mem8[SPRITE_FRAME_BUSY_LATCH2] !== 0) return;

  // ── Countdown gate: only swap a preset when the clock expires ───────────────────────────
  // ANIM_FRAME_TIMER (0x81b4) paces the whole thing. On any frame it is still running we simply tick it
  // down by one and leave — the buffer is untouched, so the lanes keep the timing profile installed last
  // swap. The reach-zero frame falls through to the swap below. (Timer is non-zero here, so no wrap.)
  if (mem8[ANIM_FRAME_TIMER] !== 0) {
    mem8[ANIM_FRAME_TIMER] = mem8[ANIM_FRAME_TIMER] - 1; // still counting -> just tick it down and wait
    return;
  }

  // ── Fetch the current preset's source pointer, then advance the ring ────────────────────
  // ANIM_FRAME_INDEX (0x81b3) selects one 16-bit entry from the ROM pointer table
  // ANIM_FRAME_SRC_PTR_TABLE (0x1841): entries are two bytes each, so the byte offset is 2*index. `src`
  // is the ROM address of the eleven-byte preset to install. The pointer is read for the CURRENT index
  // BEFORE the wrap test (matching the oracle, which fetches into DE at 0x1822 before its `sub 0x0a`);
  // on the wrap pass below this fetched value is simply discarded.
  const index = mem8[ANIM_FRAME_INDEX];
  const src = mem16[(ANIM_FRAME_SRC_PTR_TABLE + 2 * index)];
  const nextIndex = (index + 1) & 0xff;

  // Reload the clock now — before the wrap branch — so the timer is reset to 21 whether this pass copies
  // a frame or merely wraps the index (the ROM writes 0x15 to 0x81b4 at 0x182a, ahead of its wrap test).
  mem8[ANIM_FRAME_TIMER] = TIMER_RELOAD;

  // ── Ring wrap: the tenth step resets the index and copies nothing ───────────────────────
  // When advancing would step the index to TABLE_LEN (10), the ring wraps back to entry 0 and this pass
  // installs no preset. Because the copy uses `src` for the pre-advance index, the fetch made at index 9
  // is thrown away here — so entry 9 acts purely as the wrap marker and its bytes never reach the buffer.
  if (nextIndex === TABLE_LEN) {
    mem8[ANIM_FRAME_INDEX] = 0; // index reached the table end -> reset to start, no frame copied this pass
    return;
  }

  // Not wrapping: commit the advanced index so the next expiry reads the following table entry.
  mem8[ANIM_FRAME_INDEX] = nextIndex;

  // ── Install the preset: copy eleven bytes ROM -> lane-control buffer ─────────────────────
  // Copy FRAME_BYTES (11) bytes from the ROM preset at `src` into ANIM_FRAME_BUFFER (0x819b) — the ROM's
  // LDIR of 0x0b bytes. This overwrites the lane-control block in one shot, so from the very next frame
  // advanceScrollLaneObjects moves every lane at its new speed/sub-rate.
  for (let i = 0; i < FRAME_BYTES; i++) {
    mem8[(ANIM_FRAME_BUFFER + i)] = mem8[(src + i)];
  }
}
