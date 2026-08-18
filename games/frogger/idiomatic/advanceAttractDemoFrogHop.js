// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceAttractDemoFrogHop  —  ROM 0x23b7  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The per-vblank *continuation* half of the attract-demo frog's auto-pilot. During the attract demo a
 *   canned script hops a frog across the same river the player would cross, with no joystick attached.
 *   Every displayed frame this routine takes whichever hop is currently in flight and steps it forward
 *   one animation frame, so a hop that was *begun* on an earlier frame plays out smoothly over its fixed
 *   run of frames.
 *
 * WHERE IT SITS
 *   Called once per vblank, immediately after driveAttractDemoFrogHop (0x236d) — its 1:1 partner. That
 *   sibling is the *begin* half: when its dwell counter drains it reads the next entry from the hop
 *   script table HOP_FRAME_TABLE (0x2e68) and raises one direction's hop-active flag to KICK OFF a hop.
 *   This routine is the *advance* half: it does not read the script at all, it just carries forward
 *   whatever hop the begin driver (or a still-running earlier hop) left active. It is the attract-mode
 *   twin of the real-play input dispatcher scanFrogInputAndDispatchHop (0x1acb), which runs the very same
 *   four-direction scan against live joystick input; both share the hop-active flags and arrival mirrors.
 *
 * LIVE-OUT
 *   Memory only. It either delegates to one directional advance handler (which moves the frog and stamps
 *   its sprite) or writes a single arrival-mirror byte to 0. It returns nothing the caller reads.
 */
import {
  FROG_HOP_DOWN_ACTIVE, FROG_HOP_UP_ACTIVE, FROG_HOP_RIGHT_ACTIVE, FROG_HOP_LEFT_ACTIVE,
  FROG_HOP_DOWN_ARRIVAL, FROG_HOP_UP_ARRIVAL, FROG_HOP_RIGHT_ARRIVAL, FROG_HOP_LEFT_ARRIVAL,
} from "./names.js";
import {
  advanceFrogHopDown, advanceFrogHopUp,
  advanceFrogHopRight, advanceFrogHopLeft,
} from "./animateFrogHop.js";

export function advanceAttractDemoFrogHop(m) {
  const { mem8 } = m;

  // The four directions are scanned in a FIXED PRIORITY ORDER — DOWN, then UP, then RIGHT, then LEFT —
  // and each `return advance…(m)` is a tail-call that exits the whole routine. So the first direction
  // found active wins outright: its hop is advanced and the remaining directions are never examined.
  // DOWN therefore outranks all others (matching the real-play scan, where DOWN can interrupt any hop in
  // flight). At most one hop advances per frame, which is what keeps the demo frog to a single hop at a
  // time. The falls-through pattern below repeats once per direction.

  // ── DOWN ──────────────────────────────────────────────────────────────────────────────
  // FROG_HOP_DOWN_ACTIVE (0x8248) is nonzero while a down-hop is in progress. If so, hand the frame to
  // advanceFrogHopDown (ROM 0x1bba): it ticks the down animation counter, steps FROG_Y down, stamps the
  // moving/rest sprite, and on the last frame sets the down arrival mirror — then we return.
  if (mem8[FROG_HOP_DOWN_ACTIVE] !== 0) return advanceFrogHopDown(m);
  // No down-hop running: clear FROG_HOP_DOWN_ARRIVAL (0x824c), the "down hop just finished" latch that
  // the advance handler raises on drain. Zeroing it while the direction is idle re-arms it cleanly for
  // the next down-hop, so a stale arrival flag can't make the next hop look already-complete.
  mem8[FROG_HOP_DOWN_ARRIVAL] = 0;

  // ── UP ────────────────────────────────────────────────────────────────────────────────
  // FROG_HOP_UP_ACTIVE (0x8249): if a up-hop is live, advanceFrogHopUp (ROM 0x1c0d) steps FROG_Y up,
  // stamps the sprite, and on drain scores the row-crossing progress before marking arrival.
  if (mem8[FROG_HOP_UP_ACTIVE] !== 0) return advanceFrogHopUp(m);
  // Idle up direction: reset its arrival mirror FROG_HOP_UP_ARRIVAL (0x824d) for the next up-hop.
  mem8[FROG_HOP_UP_ARRIVAL] = 0;

  // ── RIGHT ─────────────────────────────────────────────────────────────────────────────
  // FROG_HOP_RIGHT_ACTIVE (0x824a): if a right-hop is live, advanceFrogHopRight (ROM 0x1c76) steps
  // FROG_X right and stamps the sprite, marking arrival on the final frame.
  if (mem8[FROG_HOP_RIGHT_ACTIVE] !== 0) return advanceFrogHopRight(m);
  // Idle right direction: reset its arrival mirror FROG_HOP_RIGHT_ARRIVAL (0x824e).
  mem8[FROG_HOP_RIGHT_ARRIVAL] = 0;

  // ── LEFT ──────────────────────────────────────────────────────────────────────────────
  // FROG_HOP_LEFT_ACTIVE (0x824b): the lowest-priority direction. If a left-hop is live, advanceFrogHopLeft
  // (ROM 0x1cd5) steps FROG_X left and stamps the sprite, marking arrival on the final frame.
  if (mem8[FROG_HOP_LEFT_ACTIVE] !== 0) return advanceFrogHopLeft(m);
  // Idle left direction: reset its arrival mirror FROG_HOP_LEFT_ARRIVAL (0x824f). With every direction
  // idle we reach the end having cleared all four mirrors and advanced nothing — the demo frog is at rest
  // between scripted hops.
  mem8[FROG_HOP_LEFT_ARRIVAL] = 0;
}
