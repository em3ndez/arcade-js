// SPDX-License-Identifier: GPL-3.0-only
//
// advancePlayerShotAndStageSprite (ROM 0x0898, [seen]) -- run the player shot, then draw it.
//
// WHAT IT IS
//   The render wrapper around advancePlayerShot. Each frame it first services the shot's timing engine
//   (advancePlayerShot, ROM 0x08bc), then reads the resulting {counter, field} pair back as a screen
//   coordinate and stages the shot's two sprite render cells so the bullet appears at its new position.
//
// ROLE IN THE MACHINE
//   advancePlayerShot leaves the live shot state in loc_4209 (the position counter, our X source) and
//   loc_420a (the field, seeded from the ship's column). This routine turns that pair into the two cells
//   the sprite hardware reads: loc_409f is the shot's low byte (X), loc_409d its code cell. The
//   orientation flag loc_4018 bit0 selects between two low-byte X formulas so the bullet draws correctly
//   whether or not the screen is flipped; the field is bit-complemented into the code cell. (mechanisms.md,
//   "The player shot".)
//
// LIVE-OUT: loc_409f, loc_409d (the shot's two render cells).
import { loc_4018, loc_4209, loc_420a, loc_409d, loc_409f } from "./names.js";
import { advancePlayerShot } from "./advancePlayerShot.js";

export function advancePlayerShotAndStageSprite(m) {
  const { mem8 } = m;

  // Service the shot's timing engine, then read its position counter (lo) and field byte (hi) back out.
  advancePlayerShot(m);
  const lo = mem8[loc_4209];
  const hi = mem8[loc_420a];

  // Stage the render cells from that pair. The orientation flag loc_4018 bit0 flips the X math so the
  // bullet lands correctly on a flipped screen; the code cell is the complemented field byte.
  // direction bit set -> X = counter - 1; clear -> X = complement(counter) + 252
  mem8[loc_409f] = mem8[loc_4018] & 0x01 ? lo - 1 : ~lo + 252;
  mem8[loc_409d] = ~hi;
}
