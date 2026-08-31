// SPDX-License-Identifier: GPL-3.0-only
import {
  GAME_ACTIVE_FLAG,
  SIREN_ENABLE_GATE,
  SIREN_FRAME_COUNTDOWN,
  SIREN_PHASE_BYTE,
  SIREN_DISPLAY_CMD_A,
  SIREN_DISPLAY_CMD_B,
} from "./names.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
/**
 * tickIdleSirenAndTogglePhase — the attract-mode warning-siren heartbeat.
 *
 * ROM 0x19ca-0x19ed. Grounding: [seen].
 *
 * WHAT IT IS: a tiny per-frame tick that drives the two-tone warning siren the machine plays
 * while it is sitting idle (no game in progress). Each frame it is called; most frames it does
 * nothing, but every 0x18 frames it flips the siren between its two alternating notes and hands
 * the corresponding sound/display command to the command ring. The audible effect is the slow
 * back-and-forth wail you hear on the attract screen.
 *
 * ROLE IN THE MACHINE: the siren is a purely idle-time effect, so this tick is fenced behind
 * two conditions. It runs only when no game is active (GAME_ACTIVE_FLAG, 0x8806, is zero) AND
 * the siren has been enabled (SIREN_ENABLE_GATE, 0x8d68, is nonzero). When a game starts the
 * active flag goes up and this tick immediately falls silent; the enable gate lets the rest of
 * the attract logic arm or disarm the siren independently.
 *
 * THE STATE IT OWNS (all in RAM page 0x8d):
 *   - SIREN_FRAME_COUNTDOWN (0x8d6a): frames remaining until the next toggle. Counts down one
 *     per call and reloads to 0x18 on expiry.
 *   - SIREN_PHASE_BYTE (0x8d69): which of the two siren notes is current. Bit 0 selects the
 *     phase; the byte is forced to 0 or 1 as it toggles.
 *
 * THE TWO NOTES: on each toggle exactly one of two fixed command words is queued into the
 * display/sound command ring — SIREN_DISPLAY_CMD_A (0x060f) or SIREN_DISPLAY_CMD_B (0x068f) —
 * and the ring's consumer turns that into the actual sound. The two words are the "up" and
 * "down" halves of the siren wail.
 *
 * LIVE-OUT: memory only — the decremented/reloaded countdown, the toggled phase byte, and at
 * most one command appended to the ring. Nothing is returned; this is a fire-and-forget tick
 * whose effects are read by other parts of the machine, never by the caller.
 */

const COUNTDOWN_RELOAD = 0x18; // frames between siren toggles (reload value for the countdown)

export function tickIdleSirenAndTogglePhase(m) {
  const { mem8 } = m;

  // GATE 1 — idle only. GAME_ACTIVE_FLAG (0x8806) is raised while a life is in play and cleared
  // at game-over. The warning siren belongs to the idle/attract state, so a nonzero flag means a
  // game is running and the tick bails without touching anything.
  if (mem8[GAME_ACTIVE_FLAG] !== 0) return; // a game is running -> no siren

  // GATE 2 — siren armed. SIREN_ENABLE_GATE (0x8d68) is the on/off switch the surrounding attract
  // logic uses to arm the siren. Zero means the siren is disabled, so there is nothing to tick.
  if (mem8[SIREN_ENABLE_GATE] === 0) return; // siren disabled

  // COUNTDOWN — advance the per-frame timer. SIREN_FRAME_COUNTDOWN (0x8d6a) is decremented once
  // per call, wrapped to a byte, and written straight back. This paces the toggle: the note only
  // flips when the countdown reaches zero.
  const countdown = (mem8[SIREN_FRAME_COUNTDOWN] - 1) & 0xff;
  mem8[SIREN_FRAME_COUNTDOWN] = countdown;
  if (countdown !== 0) return; // not expired yet -> wait for the next frame

  // EXPIRY — the interval elapsed, so reload the countdown to 0x18 for the next interval and then
  // toggle the siren to its other note.
  mem8[SIREN_FRAME_COUNTDOWN] = COUNTDOWN_RELOAD;

  // TOGGLE — SIREN_PHASE_BYTE (0x8d69) records the current note in bit 0. Read that bit to choose
  // which way to flip: an odd phase falls to note B, an even phase rises to note A. In either case
  // the phase byte is forced to the opposite value (0 or 1) and the matching command word is
  // pushed into the display/sound command ring, where the ring consumer plays it.
  if (mem8[SIREN_PHASE_BYTE] & 0x01) {
    // Currently the odd/A phase -> switch to phase B: clear the phase byte and queue note B.
    mem8[SIREN_PHASE_BYTE] = 0x00;
    enqueueDisplayCommand(m, SIREN_DISPLAY_CMD_B);
  } else {
    // Currently the even/B phase -> switch to phase A: set the phase byte and queue note A.
    mem8[SIREN_PHASE_BYTE] = 0x01;
    enqueueDisplayCommand(m, SIREN_DISPLAY_CMD_A);
  }
}
