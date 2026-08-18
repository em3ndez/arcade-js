// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveAttractDemoFrogHop  —  ROM 0x236d  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The BEGIN half of the attract-demo frog's auto-pilot. When the machine is showing its attract demo,
 *   a canned script hops a frog across the very same river the player would cross, with no joystick
 *   attached. This routine is the metronome-and-launcher of that script: most frames it does nothing but
 *   count down a dwell timer, and every so-many frames it wakes up, reads the next byte of the hop script,
 *   and KICKS OFF one directional hop. The smooth per-frame animation of that hop is then carried by its
 *   1:1 partner advanceAttractDemoFrogHop (0x23b7), which carries that hop forward later in the same
 *   frame pass (the collision/input stage runs in between).
 *
 * WHERE IT SITS
 *   Called first, once per frame, from the in-play frame dispatcher driveInPlayFrameUpdate (0x2341) — the
 *   sub-engine sequence that also runs collisions, rendering, and lane motion. That dispatcher only runs
 *   when GAME_MODE (0x83d6) == 1, and MAME grounding shows every hit of this routine lands in the attract
 *   demo (PLAY_FLAG 0x83fe == 0, no human at the controls) — never in real play. So although it rides the
 *   "in-play" engine, in practice it is purely the demo's autopilot. It is the scripted twin of the
 *   real-play input scanner scanFrogInputAndDispatchHop (0x1acb): both share the same directional
 *   hop-begin handlers, one reading a canned table and the other reading the live joystick.
 *
 * LIVE-OUT
 *   Memory only. It writes the dwell counter and phase index, delegates to one directional hop-begin
 *   handler (which moves/animates the frog), or on the end-of-script marker clears three flags. It returns
 *   nothing the caller reads.
 */
import { NotImplemented } from "../../../boards/frogger/io.js";
import { HOLD_FLAG, TWO_PLAYER_START_FLAG, GATED_COUNTDOWN_ENABLE_FLAG, IN_PLAY_BOARD_STATE_BYTE, ATTRACT_HOP_DWELL, HOP_FRAME_TABLE } from "./names.js";
import {
  beginFrogHopLeft, beginFrogHopRight, beginFrogHopUp, beginFrogHopDown,
} from "./animateFrogHop.js";

// Value the dwell counter is reloaded to after each scripted hop fires: 0x30 (48) frames of pause before
// the next script byte is read. This is what paces the demo frog — one hop roughly every 48 frames rather
// than one every frame — matching the ROM's reload constant.
const DWELL_RELOAD = 0x30;

export function driveAttractDemoFrogHop(m) {
  const { mem8 } = m;

  // ── Gate 1: input-lock / countdown gate ─────────────────────────────────────────────────
  // GATED_COUNTDOWN_ENABLE_FLAG (0x826c) is the countdown-enable flag; while it is set the frog is under
  // a timed lock (the death/ready countdown owns the frog, not the hop driver). The autopilot must stand
  // down and touch nothing until that lock clears, so we return outright.
  if (mem8[GATED_COUNTDOWN_ENABLE_FLAG] !== 0) return;

  // ── Gate 2: hold gate ───────────────────────────────────────────────────────────────────
  // HOLD_FLAG (0x8004) is the shared hold / object-frog-hit flag. When it is raised the frog is being held
  // in place by another subsystem (e.g. a sprite-object collision), so no new hop may start this frame.
  if (mem8[HOLD_FLAG] !== 0) return;

  // ── Dwell tick: pace the script ─────────────────────────────────────────────────────────
  // ATTRACT_HOP_DWELL (0x8299) is the between-hops pause counter. While it is still running we simply
  // decrement it by one and return — this is what spaces the scripted hops out over time. Only when it
  // reaches 0 (below) does a fresh hop get read and launched.
  const dwell = mem8[ATTRACT_HOP_DWELL];
  if (dwell !== 0) {
    mem8[ATTRACT_HOP_DWELL] = dwell - 1;
    return;
  }

  // ── Re-arm the dwell and step to the next script entry ──────────────────────────────────
  // The pause has drained, so arm the next pause (reload to 0x30) and advance the script cursor. The phase
  // index lives in IN_PLAY_BOARD_STATE_BYTE (0x829a); it is incremented FIRST (wrapping at 256), then that
  // NEW index selects the script byte below — so consecutive fires walk forward through the table.
  mem8[ATTRACT_HOP_DWELL] = DWELL_RELOAD;
  const phase = (mem8[IN_PLAY_BOARD_STATE_BYTE] + 1) & 0xff;
  mem8[IN_PLAY_BOARD_STATE_BYTE] = phase;

  // ── Read this phase's frame code from the hop script table ──────────────────────────────
  // HOP_FRAME_TABLE (0x2e68) is the canned hop script: one byte per phase telling the demo which direction
  // to hop (or to idle, or that the script has ended). Read the byte at the just-advanced phase index.
  const code = mem8[HOP_FRAME_TABLE + phase];

  // 0xff is the end-of-script sentinel: rewind the script and clear its flags, then we are done.
  if (code === 0xff) return resetAttractHopScript(m);

  // ── Dispatch the frame code to a directional hop-begin ──────────────────────────────────
  // The four active codes each launch one direction's hop through the shared begin handlers in
  // animateFrogHop.js (they raise that direction's hop-active flag and stamp the first sprite; the partner
  // advanceAttractDemoFrogHop then steps it each following frame). 0x0e is a scripted idle slot — the frog
  // just waits this cycle. Any other value should be impossible: the ROM table only ever holds these codes,
  // so a stray byte means the table offset or lookup is wrong, and we fail loudly rather than mis-hop.
  switch (code) {
    case 0x02: return beginFrogHopLeft(m);
    case 0x05: return beginFrogHopRight(m);
    case 0x08: return beginFrogHopUp(m);
    case 0x0b: return beginFrogHopDown(m);
    case 0x0e: return; // scripted no-op frame: dwell this cycle without hopping
    default:
      throw new NotImplemented(
        `driveAttractDemoFrogHop: frame code 0x${code.toString(16)} at phase ${phase} is not a dispatch slot`,
      );
  }
}

// End-of-script (0xff) handler: rewind the demo hop script back to the start and drop its flags.
//   • IN_PLAY_BOARD_STATE_BYTE (0x829a) → 0  rewinds the phase cursor to the top of the table.
//   • ATTRACT_HOP_DWELL       (0x8299) → 0  so the very next frame immediately re-arms and fires phase 1,
//                                           looping the demo hop-across seamlessly.
//   • TWO_PLAYER_START_FLAG   (0x825b) → 0  clears the two-player-start flag the demo left set.
function resetAttractHopScript(m) {
  const { mem8 } = m;
  mem8[IN_PLAY_BOARD_STATE_BYTE] = 0;
  mem8[ATTRACT_HOP_DWELL] = 0;
  mem8[TWO_PLAYER_START_FLAG] = 0;
}
