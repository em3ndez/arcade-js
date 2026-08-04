// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2ce6 — retire one record of a four-record sprite group as the 25m bonus counter runs
 * down, then continue into the barrel-record preset.
 *
 * The head of the 25m barrel-release chain. Its caller is the slot claim that hands out a
 * barrel record; the claim has just charged the release against the bonus counter and left its
 * pointer aimed at that counter, so the value read here is the bonus AFTER this release was
 * paid for. In play the counter starts at 50 on the first 25m board and steps down one notch
 * per barrel released.
 *
 * While four or more remain, this routine does nothing. Below four it zeroes the X field of the
 * record whose index EQUALS the remaining count, in a four-record sprite group — so the group
 * loses one record per remaining step and is empty when the counter reaches 0. Zeroing a sprite
 * record's X takes it off the display: the raster row test can never be satisfied for a record
 * whose X is 0 on any visible scanline, and that is this game's established way to blank a
 * sprite.
 *
 * The group is written in exactly two places: the 25m board build, which stamps all four
 * records from a fixed template, and here. The template is four records sharing one tile code
 * and one attribute, laid out as a two-by-two block, so what this routine retires is a fixed
 * four-piece decoration built with the 25m board.
 *
 * NOT CLAIMED: what those four sprites DEPICT. What the code and the template establish is the
 * structure — four records, one retired per remaining count, and a threshold equal to the
 * group's record count.
 *
 * Both arms then continue into the barrel-record preset, which fills in the freshly-claimed
 * barrel record's sprite fields and falls on into the frame-gated renderer tick.
 *
 * This chain is ORDINARY 25m BARREL PLAY: it runs at gameplay sub-states, on the girder board,
 * once per barrel released, and never during the opening Kong-climb cutscene. Which named
 * Donkey Kong object either barrel kind is has not been established, so no lore name appears.
 *
 * LIVE-OUT: memory-only.
 */

import { SPRITE_X } from "./names.js"; // sprite-record field offset (+0), NOT the object-record OBJ_ACTIVE
import { stampReleasedBarrelKind } from "./stampReleasedBarrelKind.js";

const COUNTDOWN_SPRITES = 0x69a8; // the four-record sprite group, seeded at 25m board build
const COUNTDOWN_RECORDS = 4; // records in that group — and the count below which they start retiring
const SPRITE_RECORD_BYTES = 4; // stride of a sprite record

export function loc_2ce6(m) {
  const { regs, mem } = m;

  // The caller leaves its pointer on the bonus counter, which it has just decremented for
  // this release, so the value read here is the bonus after the charge.
  const remaining = mem.read8(regs.hl);

  // Below four remaining, retire the record whose index is the remaining count: one record goes
  // per step, and the group is empty at zero. Zeroing a sprite record's X blanks it.
  if (remaining < COUNTDOWN_RECORDS) {
    mem.write8(COUNTDOWN_SPRITES + remaining * SPRITE_RECORD_BYTES + SPRITE_X, 0);
  }

  // Both arms continue into the barrel-record preset head.
  return stampReleasedBarrelKind(m);
}
