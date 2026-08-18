// SPDX-License-Identifier: GPL-3.0-only
/**
 * animateSpriteObjectFrame  —  ROM 0x29c9  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The frame-animation arm for a dispatcher-A sprite object — the free-drifting, two-tile creatures that
 *   Frogger scrolls along its river/road lanes (logs, turtles, and the like). Every few frames it advances
 *   the object's animation phase and re-stamps its pair of hardware-sprite tiles, so the creature visibly
 *   cycles through its frames (a turtle bobs, a swimmer paddles) as it slides across the field.
 *
 * WHERE IT SITS
 *   The SECOND of dispatcher A's five per-object arms, run once per frame from dispatchSpriteObjectArmsA
 *   (ROM 0x29b9) in fixed ROM order: spawn, ANIMATE-FRAME (this), motion, place-slot-and-retire, hit-test.
 *   Only the in-play sprite-object cluster (driveSpriteObjectCluster, ROM 0x2970) ever reaches it — the
 *   attract mode never does — and even then it steps the sprite only when the per-object frame timer expires,
 *   so on most frames it falls straight through the first `return` without touching the sprite at all.
 *
 *   `record` (Z80 IX) is the object's 16-byte work-RAM record (SPRITE_OBJECT_RECORD_A, e.g. 0x8440); `slot`
 *   (Z80 IY) is its 8-byte hardware sprite slot (SPRITE_OBJECT_SLOT_A, e.g. 0x8048), which stacks TWO 4-byte
 *   [X, code, color, Y] hardware entries to make one 16px-wide, two-tile creature.
 *
 * LIVE-OUT
 *   Memory only. It writes the record's frame timer (+8) and, on an expiry, its phase (+6), and stages four
 *   sprite-slot bytes (+1 tile, +5 tile+1, +2 and +6 color). It returns nothing and leaves no register the
 *   caller reads.
 */
import { SPRITE_OBJECT_PHASE_TILE_TABLE } from "./names.js";

// Reload value for the record's +8 frame-hold timer (ROM `ld (ix+0x08),0x0c`): after a step, the current
// tile is held for 12 more frames before the next step.
const FRAME_RELOAD = 12;

// The phase runs DOWNWARD as a 4-frame cycle (4→3→2→1); phase 1 wraps back to 4.
const PHASE_WRAP = 4;

// Color/attribute byte written into both stacked sprite entries (slot+2 and slot+6). The ROM hard-codes 4.
const SPRITE_COLOR = 4;

export function animateSpriteObjectFrame(m, record = m.regs.ix, slot = m.regs.iy) {
  const { mem8 } = m;

  // ── Tick the animation-frame timer (record +8) ───────────────────────────────────────
  // The +8 byte is this object's frame-hold counter. Decrement it once per frame (ROM `dec (ix+0x08)`); the
  // subtract is taken modulo 256, so a stored 0 rolls to 255 rather than going negative. Only when the count
  // reaches exactly 0 does the sprite advance a frame — any other value means the current tile still has
  // frames to live, so we `ret nz` here without touching the sprite. This is the overwhelmingly common path.
  const timer = (mem8[(record + 0x08)] - 1) & 0xff;
  mem8[(record + 0x08)] = timer;
  if (timer !== 0) return; // frame timer not yet expired — hold the current tile

  // ── Timer expired: reload it, then read the phase/state byte (record +6) ──────────────
  // Reload the frame timer (ROM `ld (ix+0x08),0x0c`) so the next hold starts fresh. The +6 byte is the
  // object's state/phase: 0 = idle, 1 = armed, and from there the animation phase counting 1..4. An idle
  // object (phase 0) draws nothing this frame, so `ret z` bails — the timer has still been reloaded above,
  // but no tile is staged.
  mem8[(record + 0x08)] = FRAME_RELOAD;
  const phase = mem8[(record + 0x06)];
  if (phase === 0) return; // phase 0 is inactive — nothing to draw

  // ── Step the phase down (1 wraps back to 4) and store it ──────────────────────────────
  // The animation walks the phase DOWNWARD, 4→3→2→1, and wraps 1 back to 4 for a 4-frame loop (ROM
  // `dec a` with a `ld a,0x04` fallthrough on the wrap). Write the new phase back into +6.
  const nextPhase = phase === 1 ? PHASE_WRAP : phase - 1;
  mem8[(record + 0x06)] = nextPhase;

  // ── Stage the sprite: phase tile, folded with flip bits, into the two-tile slot ───────
  // SPRITE_OBJECT_PHASE_TILE_TABLE (ROM 0x2cd5) maps the stepped phase to this frame's base tile code (ROM
  // `ld a,(0x2cd5+phase)`). The record's +5 byte carries the horizontal-flip bit (0x00 or 0x80), which the
  // motion arm toggles at each band turn; OR it into the tile so the creature faces its travel direction.
  // Then stage the object into its 8-byte hardware slot as a stacked pair: slot+1 gets the tile, slot+5 the
  // next tile (tile+1) for the second stacked entry, and both color bytes (slot+2 and slot+6) get
  // SPRITE_COLOR. Writing these slot bytes IS drawing the creature — the machine mirrors the slot into the
  // OBJRAM sprite hardware every frame.
  const tile = mem8[(SPRITE_OBJECT_PHASE_TILE_TABLE + nextPhase)] | mem8[(record + 0x05)];
  mem8[(slot + 0x01)] = tile;
  mem8[(slot + 0x05)] = tile + 1;
  mem8[(slot + 0x02)] = SPRITE_COLOR;
  mem8[(slot + 0x06)] = SPRITE_COLOR;
}
