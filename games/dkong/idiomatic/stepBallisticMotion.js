// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepBallisticMotion — advance an airborne actor one frame along its ballistic arc.
 *
 * Coordinate A drifts at constant velocity; coordinate B is pushed by its velocity and
 * then by a gravity term that ramps with the airborne-frame counter, tracing a parabola.
 * Every field access is relative to the caller's record pointer.
 *
 * LIVE-OUT: the five written record bytes plus the new coordinate-B value, returned in HL.
 */
import { u16 } from "../../../core/int.js";

export function stepBallisticMotion(m, ix = m.regs.ix) {
  const { mem8 } = m;
  const at = (d) => u16(ix + d);

  const posA = (mem8[at(0x03)] << 8) | mem8[at(0x04)];
  const velA = (mem8[at(0x10)] << 8) | mem8[at(0x11)];
  const newA = u16(posA + velA);
  mem8[at(0x03)] = newA >> 8;
  mem8[at(0x04)] = newA;

  const posB = (mem8[at(0x05)] << 8) | mem8[at(0x06)];
  const velB = (mem8[at(0x12)] << 8) | mem8[at(0x13)];
  const t = mem8[at(0x14)];             // read BEFORE the bump below
  const gravity = 16 * t + 8;           // (2·t+1)·8
  const newB = u16(posB - velB + gravity);
  mem8[at(0x05)] = newB >> 8;
  mem8[at(0x06)] = newB;
  mem8[at(0x14)] = (t + 1);

  return [m.regs.h = newB >> 8, m.regs.l = newB & 0xff];
}
