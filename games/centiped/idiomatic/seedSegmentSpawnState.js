// SPDX-License-Identifier: GPL-3.0-only
import {
  loc_88, loc_ab, CONFIG_DIP_BYTE, loc_a9, OBJECT_Y_STEER, loc_51, loc_f0, loc_71, loc_61,
  loc_41, loc_a1, SFX_TIMER_CH4, POKEY_RANDOM,
} from "./names.js";

/**
 * seedSegmentSpawnState — an init leaf that lays the fixed spawn cells for one object slot.
 *
 * Role in the machine: when a fresh centipede (or the object whose slot index is currently selected)
 * is being spawned, this routine writes the small block of zero-page cells that define its starting
 * heading and motion. It derives a signed vertical-steer selector (normally 2, dropped to 1 for an
 * "easy"/early slot, and randomly mirrored so the object can start heading either way), stashes both
 * the selector and a possibly-negated copy, folds a fixed orientation key into the heading cell, and
 * pins the remaining spawn cells to constants. It reads inputs but produces no return value — pure
 * RAM setup consumed by the sprite-table rebuild and the segment walk that follow.
 *
 * ROM: the segment spawn-seed leaf. Grounding: no header tag on the routine, but its named cells are
 * MAME-confirmed — OBJECT_Y_STEER (0x81) [seen], CONFIG_DIP_BYTE (0xfd) [seen], SFX_TIMER_CH4 (0xb5)
 * [seen], POKEY_RANDOM (0x100a) [seen]; the rest ($51/$61/$71/$41/$a1/$a9/$ab) are bare zero-page
 * placeholders read from behaviour.
 *
 * Live-out (RAM only, no return): OBJECT_Y_STEER, $51, $71, $61, $41, $a1, SFX_TIMER_CH4.
 */
export function seedSegmentSpawnState(m) {
  // $88 is the per-object slot index — which of the object slots this spawn is for. Every indexed
  // read below hangs off it, so the whole routine seeds exactly one slot.
  const x = m.mem8[loc_88]; // object slot index

  // Base selector is 2 (the object's initial vertical step magnitude). When this slot's gate byte
  // $ab+X is clear, a difficulty threshold decides whether to soften it to 1: the threshold is built
  // from bit 6 of the config DIP forced with 0x10, and if it meets-or-exceeds the slot's $a9+X value
  // the selector drops to 1 — a gentler start on lower difficulty / early slots.
  let sel = 0x02;
  if (m.mem8[(loc_ab + x) & 0xff] === 0) {
    const threshold = (m.mem8[CONFIG_DIP_BYTE] & 0x40) | 0x10; // config-derived threshold
    if (threshold >= m.mem8[(loc_a9 + x) & 0xff]) sel = 0x01; // drop the selector to 1
  }
  m.mem8[OBJECT_Y_STEER] = sel; // stash the selector

  // Randomise the *direction*: on POKEY RNG bit 2 the selector is two's-complement negated, so the
  // object is equally likely to start stepping up as down. The (possibly negated) copy lands in $51.
  if (m.mem8[POKEY_RANDOM] & 0x04) sel = (0x100 - sel) & 0xff; // random bit -> negate
  m.mem8[loc_51] = sel; // and its (possibly negated) copy

  // Seed the remaining spawn cells. $71 gets a fixed orientation key folded through $f0 (the
  // per-wave scramble parameter) so the heading matches the field's current fold; the rest are fixed
  // constants that define the initial coordinate/motion, and the ch4 SFX timer is silenced so no
  // stale spawn sound leaks into the new object.
  m.mem8[loc_71] = 0x60 ^ m.mem8[loc_f0]; // fold a fixed key into the heading cell
  m.mem8[loc_61] = 0xff; // remaining spawn cells to fixed constants
  m.mem8[loc_41] = 0xf8;
  m.mem8[loc_a1] = 0x60;
  m.mem8[SFX_TIMER_CH4] = 0x00;
}
