// SPDX-License-Identifier: GPL-3.0-only
/** countTheKillAndGrantTheSharedToken — the frame an object begins dying: ask for the death pair of sounds, take one off the
 * round's kill count, and then decide whether this object gets to claim a shared slot.
 *
 * The kill count is floored rather than wrapped — a count already at zero is left alone. The claim
 * is guarded three deep and every guard is a plain return: the object's own cooldown byte must
 * have its top bit set, a shared arming cell must be non-zero, and a shared countdown beside it
 * must reach zero on this step. That countdown is stepped whenever the first two guards pass, so
 * every claimant spends one tick of it whether or not it wins. The winner writes its own slot
 * ordinal, marked in the top bit, into a single cell that holds one claimant at a time.
 * LIVE-OUT: memory. */

import { u8 } from "../../../core/int.js";
import { requestTwoSounds } from "./requestTwoSounds.js";
import { KILLS_REMAINING } from "./names.js";

const COOLDOWN = 0x0e;
const ORDINAL = 0x0f;
const COOLDOWN_CLAIMS = 0x80;
const CLAIM_ARMED = 0xa812;
const CLAIM_COUNTDOWN = 0xa811;
const CLAIM_HOLDER = 0xa821;
const HOLDER_MARK = 0x80;

export function countTheKillAndGrantTheSharedToken(m, object = m.regs.ix) {
  const { mem8 } = m;
  requestTwoSounds(m);

  if (mem8[KILLS_REMAINING] !== 0) mem8[KILLS_REMAINING] = mem8[KILLS_REMAINING] - 1;

  if ((mem8[object + COOLDOWN] & COOLDOWN_CLAIMS) === 0) return;
  if (mem8[CLAIM_ARMED] === 0) return;

  mem8[CLAIM_COUNTDOWN] = u8(mem8[CLAIM_COUNTDOWN] - 1);
  if (mem8[CLAIM_COUNTDOWN] !== 0) return;

  mem8[CLAIM_HOLDER] = u8(mem8[object + ORDINAL] + HOLDER_MARK);
}
