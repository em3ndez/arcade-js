// SPDX-License-Identifier: GPL-3.0-only
/**
 * selectHomeBayGoalHandler  —  ROM 0x1cff  ·  grounding: [code] (MAME-grounding pending)
 *
 * WHAT IT IS
 *   The home-bay column dispatcher. Frogger's board finishes at five home bays spaced across the top
 *   row of the screen; a frog scores a bay only by climbing into one of five narrow column bands. Once
 *   the frog has reached the top region, this routine reads its horizontal position and decides WHICH
 *   bay (if any) the frog is standing in, then hands off to that bay's goal handler — or, if the frog
 *   came up in a gap between bays (or left of the first bay), to the shared "missed" reject handler.
 *
 *   It is a pure position-to-handler router: it makes no memory writes of its own and takes no decision
 *   beyond the column match. Whether a matched bay is actually AWARDED (or was already won, or the frog
 *   is still mid-hop onto the home row) is left entirely to the handler it dispatches to.
 *
 * WHERE IT SITS
 *   Reached from the master collision/input orchestrator orchestrateCollisionsAndFrogInput (ROM 0x1a55).
 *   Its shared exit routes a frog whose row FROG_Y (0x8047) has climbed into the top region (FROG_Y <
 *   0x31) here, and every other frog to the ordinary input scan. So by the time we run, the frog is
 *   already known to be near the top — this routine only resolves the horizontal question. Note it does
 *   NOT re-test FROG_Y: the looser "top region" gate happened upstream, and the stricter "fully on the
 *   home row" test (FROG_Y < 0x2a) is applied downstream inside each goal/reject handler, so a frog
 *   still hopping the last stretch is never scored or killed prematurely.
 *
 * LIVE-OUT
 *   None of its own — it reads FROG_X and returns whatever the dispatched handler returns (all of which
 *   are memory-only, returning nothing the caller reads). This routine is a tail-dispatch: exactly one
 *   handler runs per call and its return value flows straight back out.
 */
import { FROG_X } from "./names.js";
import {
  awardHomeBay1Goal, awardHomeBay2Goal, awardHomeBay3Goal, awardHomeBay4Goal, awardHomeBay5Goal,
} from "./awardHomeBayGoal.js";
import { holdFrogMissedHomeBay } from "./holdFrogMissedHomeBay.js";

// The five home-bay column bands, each an INCLUSIVE frog-X window [lo, hi] paired with the goal handler
// for that bay. The bays sit at a regular 0x30-pixel pitch across the top row (band starts 0x15, 0x45,
// 0x75, 0xa5, 0xd5), and each band is 8 pixels wide (hi = lo + 7) — the frog must be squarely over a bay
// to score it. The gaps between bands, and any X below the first band, belong to no bay and fall through
// to the reject handler below.
const BAYS = [
  { lo: 0x15, hi: 0x1c, handler: awardHomeBay1Goal },
  { lo: 0x45, hi: 0x4c, handler: awardHomeBay2Goal },
  { lo: 0x75, hi: 0x7c, handler: awardHomeBay3Goal },
  { lo: 0xa5, hi: 0xac, handler: awardHomeBay4Goal },
  { lo: 0xd5, hi: 0xdc, handler: awardHomeBay5Goal },
];

export function selectHomeBayGoalHandler(m) {
  // ── Read the frog's horizontal position ──────────────────────────────────────────────
  // FROG_X (0x8044) [seen] is the frog's game-space X. This single byte is the whole input to the
  // dispatch: the frog's row is already known to be in the top region (gated upstream), so which bay the
  // frog is over — or whether it is over none — is decided entirely by this column value.
  const frogX = m.mem8[FROG_X];

  // ── Match the frog against each bay's column band, first hit wins ─────────────────────
  // Walk the five bands left to right. The moment the frog's X falls inside a band's inclusive [lo, hi]
  // window, tail-dispatch to that bay's goal handler and return its result. Because the bands are
  // disjoint, at most one can match; scanning in order just makes the first (and only) hit the winner.
  for (const bay of BAYS) {
    if (frogX >= bay.lo && frogX <= bay.hi) return bay.handler(m);
  }

  // ── No band matched → the frog is between bays (or left of the first) ─────────────────
  // The frog climbed to the top but not into a home column. Hand off to holdFrogMissedHomeBay (ROM
  // 0x1d77): if the frog has fully reached the home row (FROG_Y < 0x2a) over no bay it is lost (that
  // handler raises HOLD_FLAG); either way control continues into the per-frame input scan.
  return holdFrogMissedHomeBay(m);
}
