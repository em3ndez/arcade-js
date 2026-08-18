// SPDX-License-Identifier: GPL-3.0-only
/**
 * holdFrogMissedHomeBay  —  ROM 0x1d77  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The home-row "reject" handler. Frogger's board finishes at five home bays across the top of the
 *   screen; a frog wins only by climbing into one of the five column bands. This routine is where a frog
 *   that reached the top row but landed BETWEEN bays (or left of the first bay) ends up — it decides that
 *   such a frog is lost, and either way hands control on to the per-frame input scan.
 *
 * WHERE IT SITS
 *   The fall-through arm of the column dispatcher selectHomeBayGoalHandler (ROM 0x1cff). That dispatcher
 *   runs once the frog has climbed into the top region and matches the frog's X against the five inclusive
 *   home-bay column bands (0x15-0x1c, 0x45-0x4c, 0x75-0x7c, 0xa5-0xac, 0xd5-0xdc); any X that falls in a
 *   gap between bays — or below the first band — misses every bay and is routed here instead of to a
 *   bay's goal handler. This is the "you climbed to the top but not into a home" outcome.
 *
 *   Note the two-stage threshold on the frog's row. The dispatcher upstream fires on the looser test
 *   FROG_Y < 0x31 (frog is somewhere in the top region), but a frog can be that high while still hopping
 *   the last stretch onto the home row. So this routine applies the STRICTER test FROG_Y < 0x2a — "has
 *   fully reached the home row" — before declaring the frog lost. The matching bay goal handlers make the
 *   same distinction (they defer while FROG_Y >= 0x2a), so a still-climbing frog is never killed
 *   prematurely; it simply falls through to the input scan and keeps hopping.
 *
 * LIVE-OUT
 *   Memory only. On the lost case it writes a single flag cell (HOLD_FLAG); it returns nothing the caller
 *   reads. Control always continues into the input scan via a plain tail-dispatch.
 */
import { FROG_Y, HOLD_FLAG } from "./names.js";
import { scanFrogInputAndDispatchHop } from "./scanFrogInputAndDispatchHop.js";

// The frog's row is stored TOP-DOWN in screen space (grounded [seen]: FROG_Y ran E0=bottom -> 40=top as
// the frog climbed), so a SMALLER value is HIGHER up the screen. 0x2a is the row at/above which the frog
// counts as having fully reached the home row — the same "fully home" line the bay goal handlers use.
const HOME_ROW_Y = 0x2a;

export function holdFrogMissedHomeBay(m) {
  const { mem8 } = m;

  // ── The frog is lost when it reaches the home row over no bay ─────────────────────────
  // We only get here because the frog's X missed all five bay bands. If FROG_Y (0x8047) is now above the
  // home-row line (strictly less than 0x2a), the frog has finished its climb landing on solid top-row
  // scenery rather than in a home — a miss with nowhere to go. Raise HOLD_FLAG (0x8004): that same flag
  // halts the frog and arms the death path (driveFrogDeathAnimation is gated on it), so setting it here is
  // what "loses the frog". While FROG_Y is still >= 0x2a the frog hasn't fully arrived yet, so we leave
  // the flag alone and let it keep hopping.
  if (mem8[FROG_Y] < HOME_ROW_Y) mem8[HOLD_FLAG] = 1;

  // ── Either way, run the per-frame input scan ─────────────────────────────────────────
  // Whether or not the frog was lost, control continues into scanFrogInputAndDispatchHop (ROM 0x1acb) —
  // the per-vblank joystick scan + directional-hop dispatcher. When the frog was lost the hold flag we
  // just raised makes that scan return early (input is locked during the death sequence); when it wasn't,
  // the scan reads the stick and dispatches the next hop as normal. In the ROM this is a straight tail
  // fall-through, so it is expressed here as a plain tail-dispatch.
  return scanFrogInputAndDispatchHop(m);
}
