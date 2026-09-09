// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import {
  loc_00, loc_43, loc_53, loc_63, loc_73, loc_83, loc_86, loc_8d,
  loc_91, loc_92, loc_93, loc_94, loc_ff, loc_fe, loc_0600, CODE_CHECKSUM_BASE,
} from "./names.js";
import { writePointerTableRow } from "./writePointerTableRow.js";
import { plotConfigTableRow } from "./plotConfigTableRow.js";
import { redrawPointerTableRowUnblanked } from "./redrawPointerTableRowUnblanked.js";
import { loc_2aeb } from "./loc_2aeb.js";
import { clampCoordToBand } from "./clampCoordToBand.js";
import { routeByCoordDelta } from "./routeByCoordDelta.js";

/**
 * loc_2119 — the per-frame layout/spine driver (ROM 0x2119). It ties the two coordinate integrator
 * spines into the frame's layout-draw pass: it lays a config-selected status row, primes the draw
 * cursor and layout cells, and then steps the $53 and $83 targets through the movement spines before
 * running the tail-writer pass and folding an integrity checksum.
 *
 * It runs only while the wave/board is live — $86 bit 7 set — and returns immediately otherwise, so it
 * costs nothing on inactive frames. When it does run, the heavy target-stepping is further gated on
 * $00 bit 7 (a frame-phase bit) and the $43 control bits both being clear; if $43 has mode bits set it
 * skips the target clamps and jumps straight to the tail writers.
 *
 * Role: path/coordinate integrator — the layout/spine driver.  Grounding: [code].
 * Live-out: $91-$94, $53, $83, $8d, $ff, $fe, plus the row/spine side-effects.
 */
export function loc_2119(m) {
  const { mem8 } = m;
  if (mem8[loc_86] < 0x80) return; // inactive unless $86 bit7 set

  // Draw the config-selected status line, then prime the layout-draw cells: $93/$94 hold the row
  // geometry (count 3, stride 32) and $91/$92 seed the 16-bit draw cursor (low 64, high 5).
  plotConfigTableRow(m);
  mem8[loc_93] = 3;
  mem8[loc_94] = 32;
  mem8[loc_91] = 64;
  mem8[loc_92] = 5;
  // Redraw the pointer-table row unblanked, and on the exact frame $00 == 0 also (re)write row 132.
  redrawPointerTableRowUnblanked(m);
  if (mem8[loc_00] === 0) writePointerTableRow(m, 132);

  // Latch the flip byte from video RAM $0600 into $ff for the writers downstream.
  mem8[loc_ff] = mem8[loc_0600];
  // Phase gate: $00 bit 7 set means this is not a target-stepping frame -> stop here.
  if ((mem8[loc_00] & 0x80) !== 0) return;
  // Mode gate: if any $43 control bit is set, skip the target clamps and run only the tail writers.
  if ((mem8[loc_43] & 0xaf) !== 0) { runTailWriters(m); return; }

  // Clamp the $53 target from $63's band, store it, and step it through the spine.
  // Below column 28 the target snaps to 1 (bottom rail), at/above 228 to 0xff (top rail); inside the
  // band it holds its previous value. The clamped target then drives the $73-axis integrator loc_2aeb.
  const h = mem8[loc_63];
  const t53 = h < 28 ? 1 : h >= 228 ? 0xff : mem8[loc_53];
  mem8[loc_53] = t53;
  loc_2aeb(m, t53, false); // A + clear carry

  // Clamp the $83 target from $73's band, store it, and step it through the spine.
  // Snapshot $73 into $8d first (a later stage measures the move), then rail-clamp: >= 48 -> 0xff,
  // < 9 -> 1, else hold. The clamped target drives the coordinate-band stepper clampCoordToBand.
  const v = mem8[loc_73];
  mem8[loc_8d] = v;
  const t83 = v >= 48 ? 0xff : v < 9 ? 1 : mem8[loc_83];
  mem8[loc_83] = t83;
  clampCoordToBand(m, t83, false); // A + clear carry

  // Every path converges on the tail-writer pass.
  runTailWriters(m);
}

/**
 * runTailWriters — the shared tail of loc_2119 (ROM tail-writer pass). It runs the coordinate-delta
 * router, then folds a rolling EOR checksum of the 20-byte block at $2120 into $fe.
 *
 * The checksum starts from the seed 0xfa and XORs the block bytes high-index-to-low, so $fe becomes a
 * one-byte fingerprint of that block — an integrity marker the machine can later compare against.
 * Grounding: [code].  Live-out: $fe plus routeByCoordDelta's side-effects.
 */
function runTailWriters(m) {
  const { mem8 } = m;
  // Route the motion bookkeeping based on the current coordinate delta.
  routeByCoordDelta(m);
  // Fold the 20-byte block at $2120 into a single EOR checksum byte, seeded at 0xfa.
  let sum = 0xfa;
  for (let i = 19; i >= 0; i--) sum = u8(sum ^ mem8[CODE_CHECKSUM_BASE + i]);
  // Publish the fingerprint into $fe.
  mem8[loc_fe] = sum;
}
