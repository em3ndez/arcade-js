// SPDX-License-Identifier: GPL-3.0-only
import { ACTIVE_OBJECT_TYPE } from "./names.js";
/**
 * loc_618a — clear the active-object type and abort the caller's frame.
 *
 * ROM address: 0x618a. Grounding tag: [seen].
 *
 * ACTIVE_OBJECT_TYPE (0x8d44) is the scratch byte that names which object the current per-frame
 * pass is working on — it steers the record-matching and sound-dispatch logic in the enemy /
 * actor handlers around 0x613d..0x6166. This routine is the "give up on this object" exit those
 * handlers share: it wipes ACTIVE_OBJECT_TYPE back to 0 and then unwinds control ONE FRAME
 * FURTHER than a normal return would.
 *
 * That extra unwind is the whole point. Reaching this routine does not resume the code that
 * reached it; instead the machine returns past that immediate caller, so the caller's own
 * remaining work is skipped and it is that caller's caller that continues. In other words, any
 * routine that lands here is aborted along with the frame it was processing. The boolean result
 * carries that outcome outward so the surrounding idiomatic code takes the abort path.
 *
 * It is reached both by direct call and by a jump from nearby handler code (around 0x619d), and
 * it calls nothing itself.
 *
 * LIVE-OUT: ACTIVE_OBJECT_TYPE cleared to 0, plus the boolean signal — always false, because
 * the only path through here is the abort. No register value is meant to survive the skip.
 */
export function loc_618a(m) {
  // Reset the active-object selector: whatever object this frame was working on is abandoned.
  m.mem8[ACTIVE_OBJECT_TYPE] = 0x00;
  // Abort: control unwinds one frame past the direct caller, so the caller does not continue.
  return false; // skip path — the caller's frame is aborted
}
