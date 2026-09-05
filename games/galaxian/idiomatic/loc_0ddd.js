// SPDX-License-Identifier: GPL-3.0-only
// Pick a horizontal target for the actor and commit the move toward it: signed-halve the gap
// between the actor's X and the reference X, bias it, and clamp to the band on the far side.
import { commitMoveToTargetX } from "./commitMoveToTargetX.js";
import { loc_4202 } from "./names.js";

const BIAS = 16;
const RIGHT_LO = 144, RIGHT_HI = 208; // band chosen when the actor is left of the reference
const LEFT_LO = 48, LEFT_HI = 112;    // band chosen when the actor is at or right of the reference

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

export function loc_0ddd(m, record = m.regs.ix) {
  const { mem8 } = m;
  const refX = mem8[loc_4202];
  const actorX = mem8[record + 0x04];
  const gap = (actorX - refX) & 0xff; // borrow (actor left of reference) rides bit 7 after halving

  let target;
  if (actorX < refX) {
    // Actor left of the reference: sign-extend the halved gap, subtract the bias, aim right.
    target = clamp((((gap >> 1) | 0x80) - BIAS) & 0xff, RIGHT_LO, RIGHT_HI);
  } else {
    // Actor at or right of the reference: halve the gap, add the bias, aim left.
    target = clamp(((gap >> 1) + BIAS) & 0xff, LEFT_LO, LEFT_HI);
  }

  return commitMoveToTargetX(m, target, record);
}
