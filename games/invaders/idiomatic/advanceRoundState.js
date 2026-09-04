// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { GAME_OBJECT_TABLE, loc_2011, loc_2015, DEMO_SHIP_DIR, PLAYER_SHOT_STATUS, FIRE_BUTTON_LATCH, ATTRACT_DEMO_PTR, GAME_IN_PROGRESS } from "./names.js";
import { readActivePlayerInput } from "./readActivePlayerInput.js";

/**
 * advanceRoundState -- the gated pre-round step, run once per frame from both the attract demo and live play.
 *
 * WHAT IT IS
 *   A single per-frame nudge that fires only when a round is armed and the field has gone idle. In the
 *   attract demo it walks the scripted-demo pointer forward (so the demo "plays itself"); in a live game it
 *   watches the fire button and arms the player's shot on a fresh press.
 *
 * ROLE IN THE MACHINE
 *   Called from the in-game main loop (ROM 0x081f) and from the attract free-run loop runAttractCycle
 *   (0x0b71). It does nothing unless the arm sentinel loc_2015 reads 0xff, the field object cells
 *   GAME_OBJECT_TABLE (0x2010) and loc_2011 are both zero, and PLAYER_SHOT_STATUS (0x2025) is zero. Past
 *   that gate it forks on GAME_IN_PROGRESS (0x20ef): attract (zero) stamps the shot status to 1 and steps
 *   ATTRACT_DEMO_PTR (0x20ed) through a small demo window; live play (nonzero) uses FIRE_BUTTON_LATCH
 *   (0x202d) to enforce one shot per distinct press. readActivePlayerInput's bit 0x10 is the fire button.
 *
 * ROM 0x1618-0x166a.  Grounding: [seen].
 *
 * LIVE-OUT: memory only (shot status / demo pointer / fire latch); no register result the callers read.
 */
export function advanceRoundState(m) {
  // Gate 1: do nothing unless the round is armed (the sentinel reads 0xff).
  if (m.mem8[loc_2015] !== 0xff) return;
  // Gate 2: do nothing while the field object cells are still busy (either one nonzero).
  if (m.mem8[GAME_OBJECT_TABLE] !== 0 || m.mem8[loc_2011] !== 0) return;
  // Gate 3: do nothing while a player shot is already in progress.
  if (m.mem8[PLAYER_SHOT_STATUS] !== 0) return;

  // Attract demo (no game in progress): drive the scripted demo forward each frame.
  if (m.mem8[GAME_IN_PROGRESS] === 0) {
    // Mark a demo "shot" as armed.
    m.mem8[PLAYER_SHOT_STATUS] = 0x01;
    // Advance the 16-bit demo pointer one byte; when its low byte runs past 0x7e, wrap it back to 0x74 (the
    // small demo window) while keeping the high byte, then read the byte it now points at for the demo to use.
    let ptr = u16(m.mem16[ATTRACT_DEMO_PTR] + 1);
    const lo = ptr & 0xff;
    if (lo >= 0x7e) ptr = ptr - lo + 0x74; // wrap the low byte back to the start of the march window
    m.mem16[ATTRACT_DEMO_PTR] = ptr;
    m.mem8[DEMO_SHIP_DIR] = m.mem8[ptr];
    return;
  }

  // Live play, fire latch already set: wait for the button to release, then clear the latch. This is the
  // trailing half of the one-shot-per-press edge detect (fire==0 clears the latch so a new press can arm).
  if (m.mem8[FIRE_BUTTON_LATCH] !== 0) {
    const fire = readActivePlayerInput(m) & 0x10;
    if (fire !== 0) return;
    m.mem8[FIRE_BUTTON_LATCH] = fire;
    return;
  }

  // Live play, fire latch clear: wait for a fresh press; on it, arm the shot and re-latch (blocking a
  // second shot until the button is released and re-pressed).
  if ((readActivePlayerInput(m) & 0x10) === 0) return;
  m.mem8[PLAYER_SHOT_STATUS] = 0x01;
  m.mem8[FIRE_BUTTON_LATCH] = 0x01;
}
