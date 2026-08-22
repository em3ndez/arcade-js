// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_6381 } from "./loc_6381.js";
import { SPRITE_ACTOR_RECORD_SLOTS } from "./names.js";
/**
 * loc_6368 — run the projectile-proximity scan against the two actor boxes, once per pass.
 *
 * The first box sits at the actor-record slot base with the I=0 hit-flag selector; the second is
 * one stride on with the stride as the selector. Each pass hands its box and selector to the scan
 * seeder, and the instant a pass claims a hit the driver aborts, leaving the remaining pass unrun.
 *
 * LIVE-OUT: none — the per-frame updater that calls this reads no register back.
 */

const PASS_COUNT = 0x02;
const BOX_STRIDE = 0x04;

export function loc_6368(m) {
  let box = SPRITE_ACTOR_RECORD_SLOTS;
  let selector = 0x00; // interrupt-parity selector: 0 for the first box
  for (let pass = PASS_COUNT; pass > 0; pass--) {
    if (!loc_6381(m, box, selector)) return; // a hit was claimed — skip the remaining pass
    box = u16(box + BOX_STRIDE);
    selector = BOX_STRIDE; // the second box selects on the stride value (=4)
  }
}
