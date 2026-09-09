// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import {
  loc_00, loc_43, loc_53, loc_63, loc_73, loc_83, loc_86, loc_8d,
  loc_91, loc_92, loc_93, loc_94, loc_ff, loc_fe, loc_0600, loc_2120,
} from "./names.js";
import { writePointerTableRow } from "./writePointerTableRow.js";
import { plotConfigTableRow } from "./plotConfigTableRow.js";
import { redrawPointerTableRowUnblanked } from "./redrawPointerTableRowUnblanked.js";
import { loc_2aeb } from "./loc_2aeb.js";
import { clampCoordToBand } from "./clampCoordToBand.js";
import { routeByCoordDelta } from "./routeByCoordDelta.js";

// Runs only while $86 is flagged active (bit7): primes the layout-draw cells $91-$94, drives the row
// writers, then (when $00 bit7 and $43 are clear) clamps the $53-from-$63 and $83-from-$73 targets through
// their spine steppers, runs the tail-writer pass, and folds a checksum of the block below into $fe.  [code]
export function loc_2119(m) {
  const { mem8 } = m;
  if (mem8[loc_86] < 0x80) return; // inactive unless $86 bit7 set

  plotConfigTableRow(m);
  mem8[loc_93] = 3;
  mem8[loc_94] = 32;
  mem8[loc_91] = 64;
  mem8[loc_92] = 5;
  redrawPointerTableRowUnblanked(m);
  if (mem8[loc_00] === 0) writePointerTableRow(m, 132);

  mem8[loc_ff] = mem8[loc_0600];
  if ((mem8[loc_00] & 0x80) !== 0) return;
  if ((mem8[loc_43] & 0xaf) !== 0) { runTailWriters(m); return; }

  // Clamp the $53 target from $63's band, store it, and step it through the spine.
  const h = mem8[loc_63];
  const t53 = h < 28 ? 1 : h >= 228 ? 0xff : mem8[loc_53];
  mem8[loc_53] = t53;
  loc_2aeb(m, t53, false); // A + clear carry

  // Clamp the $83 target from $73's band, store it, and step it through the spine.
  const v = mem8[loc_73];
  mem8[loc_8d] = v;
  const t83 = v >= 48 ? 0xff : v < 9 ? 1 : mem8[loc_83];
  mem8[loc_83] = t83;
  clampCoordToBand(m, t83, false); // A + clear carry

  runTailWriters(m);
}

// The tail-writer pass, then an EOR checksum of the 20-byte block below into $fe.  [code]
function runTailWriters(m) {
  const { mem8 } = m;
  routeByCoordDelta(m);
  let sum = 0xfa;
  for (let i = 19; i >= 0; i--) sum = u8(sum ^ mem8[loc_2120 + i]);
  mem8[loc_fe] = sum;
}
