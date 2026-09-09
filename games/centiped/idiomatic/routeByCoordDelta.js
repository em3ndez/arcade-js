// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { foldSignedMagnitude } from "./foldSignedMagnitude.js";
import { loc_2b79, loc_2b86 } from "./loc_2b79.js";
import { loc_72, loc_8d, loc_ef } from "./names.js";

/**
 * routeByCoordDelta -- a branch/dispatch step that routes control based on the signed
 * distance between the coordinate cell $72 (ROM 0x0072) and the reference cell $8d
 * (ROM 0x008d), with the direction cell $ef (ROM 0x00ef) selecting which sign of the
 * gap counts as "bail".
 *
 * ROLE IN THE MACHINE: this is one of the tiny routers in the object-motion follow-up
 * chain (reached from clampCoordToBand when an object has just had its coordinate
 * advanced). Having repositioned an actor, the game asks "how far, and on which side,
 * is it now from its reference point?" and forks: a same-side / small gap goes to the
 * coordinate-fixup stage loc_2b79, while a large opposite-side gap goes to the
 * arm-flag tail loc_2b86. It performs no RAM writes of its own -- every store happens
 * inside whichever handoff routine it tail-calls. Behaviour-derived. [code]
 *
 * MECHANISM: a 6502 SEC/SBC of $72 minus $8d yields both a signed magnitude and a
 * carry (= "no borrow" = $72 >= $8d). The $ef flag XORs against that sign: when
 * ($ef != 0) equals (delta >= 0), the actor is on the "already handled" side and the
 * routine short-circuits to the fixup. Only on the other side does the MAGNITUDE of
 * the gap matter, folded to an absolute value and thresholded at 5.
 *
 * LIVE-OUT: whatever the tail-called routine returns; this routine adds no store.
 */
export function routeByCoordDelta(m) {
  const { mem8 } = m;
  // Signed distance from the coordinate to its reference (6502 SEC/SBC $72,$8d).
  const sub = mem8[loc_72] - mem8[loc_8d];
  const noBorrow = sub >= 0; // $72 >= $8d
  // Direction gate: when $ef's truthiness matches the sign of the gap, the actor is on
  // the "settled" side -> go straight to the coordinate fixup and skip the size test.
  if ((mem8[loc_ef] !== 0) === noBorrow) return loc_2b79(m); // fixup side
  // Otherwise fold the wrapped delta to a magnitude (abs of the byte) and let its
  // size decide: bit 7 of the byte carries the sign into foldSignedMagnitude.
  const diff = u8(sub);
  const mag = foldSignedMagnitude(m, diff, (diff & 0x80) !== 0);
  // A wide gap (>= 5) means the actor is far off on the wrong side -> arm-flag tail;
  // a narrow gap still resolves through the same coordinate fixup.
  if (mag >= 0x05) return loc_2b86(m); // wide gap -> arm-flag tail
  return loc_2b79(m); // narrow gap -> fixup
}
