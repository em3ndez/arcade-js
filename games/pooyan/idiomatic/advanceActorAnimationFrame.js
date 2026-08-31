// SPDX-License-Identifier: GPL-3.0-only
import { ANIM_SCRIPT_CURSOR, ANIM_SCRIPT_RESET_PTR } from "./names.js";
import { foldTargetPresenceBits } from "./foldTargetPresenceBits.js";
/**
 * advanceActorAnimationFrame — step one actor's on-screen animation forward by a single frame.
 *
 * WHAT IT IS. Every animated thing in the game (the player and its enemies) is drawn from an actor
 * record whose last three bytes hold what the hardware shows this instant: a tile code, a colour
 * attribute, and a frame-hold countdown that says how many more frames this picture stays up. The
 * pictures themselves come from an animation "script": a compact byte stream of {tile, colour,
 * delay} triples with occasional control markers woven in. This routine reads the next step of that
 * script into one actor's record when the current frame's time runs out. `rec` (the Z80's IX) is
 * the address of the actor record being stepped.
 *
 * ROLE IN THE MACHINE. This is the shared-cursor flavour of the animator: rather than each record
 * carrying its own script pointer, four records — the player and three others one record-stride
 * apart — all march through ONE script cursor kept in work RAM (ANIM_SCRIPT_CURSOR, 0x8f00). The
 * per-frame animation sweep that drives it steps those four records in turn, so they animate in
 * lockstep off the same stream. (That whole sweep is skipped while a rope-grab is in progress, so
 * this routine only runs when the actors are free to animate.)
 *
 * ROM 0x22e6-0x2324.  Grounding tag: [seen].
 *
 * LIVE-OUT: none (memory only). It leaves the stepped picture in the record's three animation
 * fields — tile at (rec+0x10), colour at (rec+0x0f), hold countdown at (rec+0x0e) — and leaves the
 * shared script cursor ANIM_SCRIPT_CURSOR advanced past whatever it consumed.
 */
const CTRL_MARKER = 0xff; //  a 0xff script lead byte is a control marker, not a tile code
const RESET_TALLY = 3; //     target-presence fold value that would force a full script reset (never reached)
const OFF_DELAY = 0x0e; //    (rec+0x0e) frame-hold countdown: frames the current picture stays on screen
const OFF_COLOUR = 0x0f; //   (rec+0x0f) colour attribute of the current picture
const OFF_TILE = 0x10; //     (rec+0x10) tile code of the current picture

export function advanceActorAnimationFrame(m, rec = m.regs.ix) {
  const { mem8, mem16 } = m;

  // Frame-hold gate. The current picture stays up for (rec+0x0e) frames; while that countdown is
  // still non-zero the animation is not due to advance, so simply tick it down one frame and leave
  // the record's tile/colour untouched. This is what paces the animation — the delay byte of each
  // script entry decides how long its frame lingers before the next one is pulled.
  if (mem8[rec + OFF_DELAY] !== 0) {
    mem8[rec + OFF_DELAY] = mem8[rec + OFF_DELAY] - 1;
    return;
  }

  // The countdown has hit zero: it is time to pull the next script step. This loop re-reads from
  // the top whenever a control marker only redirects the cursor (a script jump) without producing a
  // drawable frame — so a marker is followed straight through to the next real entry.
  for (;;) {
    // Fetch the shared cursor (0x8f00) and peek its lead byte. That byte is either the tile code of
    // a normal 3-byte frame or the 0xff control marker.
    const cur = mem16[ANIM_SCRIPT_CURSOR];
    const lead = mem8[cur];
    // Normal entry: a {tile, colour, delay} triple. Copy the tile into (rec+0x10), the colour into
    // (rec+0x0f), and the fresh hold count into (rec+0x0e); then step the shared cursor past all
    // three bytes so the next actor (or the next expiry) reads the following entry. This is the one
    // path that actually changes what is drawn, so it returns once the new frame is installed.
    if (lead !== CTRL_MARKER) {
      mem8[rec + OFF_TILE] = lead;
      mem8[rec + OFF_COLOUR] = mem8[cur + 1];
      mem8[rec + OFF_DELAY] = mem8[cur + 2];
      mem16[ANIM_SCRIPT_CURSOR] = cur + 3;
      return;
    }
    // Control marker (0xff lead). Summarise the two enemy-target records' presence bits into a
    // single tally (foldTargetPresenceBits, ROM 0x22d0) and branch on it. When the tally is NOT the
    // reset value, the two bytes following the 0xff are an inline replacement address: write them
    // into the cursor low/high (0x8f00/0x8f01) as a script jump and loop to re-read from there.
    if (foldTargetPresenceBits(m) !== RESET_TALLY) {
      mem8[ANIM_SCRIPT_CURSOR] = mem8[cur + 1];
      mem8[ANIM_SCRIPT_CURSOR + 1] = mem8[cur + 2];
    } else {
      // Rival full-reset path: reload the cursor with the base script address (ANIM_SCRIPT_RESET_PTR,
      // 0x26e7) and loop. This only fires when the fold equals 3, and the fold seeds 0 and is only
      // rotated, so it can never reach 3 — in practice the marker always takes the inline-jump path
      // above and this branch stays dormant.
      mem16[ANIM_SCRIPT_CURSOR] = ANIM_SCRIPT_RESET_PTR;
    }
  }
}
