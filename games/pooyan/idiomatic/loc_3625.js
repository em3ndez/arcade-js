// SPDX-License-Identifier: GPL-3.0-only
import { resolveTargetColumnAndArmApproach } from "./resolveTargetColumnAndArmApproach.js";
/**
 * loc_3625 — a guard on the actor record at IX, reached by a tail-jump from the phase dispatcher.
 * If bit 0 of the +0x08 latch cell is set the actor is already committed and the handler returns
 * with no effect. Otherwise it delegates to the target-tile resolver, which runs in this same tail
 * frame and supplies the outcome.
 *
 * LIVE-OUT: none — run for its side effects; the guarded path writes nothing and the delegated path
 * forwards the resolver's own effects. IX is threaded unchanged into the resolver.
 */

const LATCH_FIELD = 0x08; //   the per-actor latch cell
const COMMIT_BIT = 0x01; //    bit0 set => already committed, guard blocks

export function loc_3625(m, rec = m.regs.ix) {
  const { mem8 } = m;
  if (mem8[rec + LATCH_FIELD] & COMMIT_BIT) return; // committed: nothing to do
  return resolveTargetColumnAndArmApproach(m, rec);
}
