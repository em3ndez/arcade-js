// SPDX-License-Identifier: GPL-3.0-only
/**
 * animateFixedShapeCycleAtHalfRate — give one sprite entry the current frame of an eight-frame
 * shape cycle from a fixed base, and one fixed byte beside it.
 *
 * ROM 0x41F1-0x4200 (loc_41f1). Grounding: [seen] (names.js ROUTINES 0x41F1).
 *
 * What it is: like its sibling animateFixedShapeCycle, it dresses one entry of the sprite SHADOW
 * (0xAA10-0xAA6F; shape code at +1, attribute byte — colour and flip — at +0x30) that
 * publishSpriteShadow copies into the hardware sprite banks once a frame. The frame is picked from
 * bits one to three of FRAME_TICK (0xA980) [seen], the once-per-frame counter, so the cycle turns
 * over once every sixteen counts. Nothing about the object is read, so every entry driven through
 * here in the same tick gets the same shape.
 *
 * Only the constants differ from the sibling's body (shape base 0x50 here, 0x40 there; attribute
 * 0x0A here, 0x44 there); both ROM bodies select the frame with the same `rrca / and 0x07`.
 *
 * Role in the machine: under MAME, read taps counted zero dispatches on runs that stayed in eras
 * 0-3 and a steady stream on a run holding ERA_INDEX at 4 — the gate its two callers sit behind;
 * on that run it wrote the full eight-frame shape cycle and the fixed byte beside it.
 *
 * Parameter: `sprite` — the address of the sprite-shadow entry to dress (IY in the ROM).
 *
 * LIVE-OUT: memory only — the shape byte and the byte at +0x30.
 */

import { FRAME_TICK } from "./names.js";

// Offsets within the sprite-shadow entry: the shape code, and the attribute byte 0x30 beyond.
const SHAPE = 1;
const ATTRIBUTE = 0x30;
// The eight shapes of the cycle are codes 0x50..0x57 (`add a,0x50`).
const FIRST_SHAPE = 80;
const SHAPES = 8;
// Each shape is held for two counts of FRAME_TICK (the ROM's `rrca` discards bit 0).
const COUNTS_PER_SHAPE = 2;
// The constant stored at +0x30 (`ld (iy+0x30),0x0a`).
const TINT = 10;

export function animateFixedShapeCycleAtHalfRate(m, sprite = m.regs.iy) {
  const { mem8 } = m;
  // Pick the frame: `ld a,(0xa980) / rrca / and 0x07` — the rotated-out bit 0 is masked away, so
  // this is the counter halved, modulo eight.
  const step = Math.floor(mem8[FRAME_TICK] / COUNTS_PER_SHAPE) % SHAPES;
  // Store the shape: base plus frame (`add a,0x50 / ld (iy+0x01),a`).
  mem8[sprite + SHAPE] = FIRST_SHAPE + step;
  // Pin the byte beside it to its one constant.
  mem8[sprite + ATTRIBUTE] = TINT;
}
