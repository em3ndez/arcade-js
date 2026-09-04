// SPDX-License-Identifier: GPL-3.0-only
import { FLEET_SOUND_STEP, FLEET_SOUND_PERIOD, SFX_OFF_TIMER, FLEET_RATE_THRESHOLDS, FLEET_RATE_TABLE, SOUND_PORT5_SHADOW, ALIEN_COUNT } from "./names.js";
import { clearSoundPort3Bit } from "./clearSoundPort3Bit.js";

/**
 * advanceFleetMarchSound (ROM 0x1775-0x17b3) -- the frame-loop half of the fleet-march "footsteps".
 *
 * WHAT IT IS
 *   The marching-alien sound is produced by two routines working in tandem: stepFleetMarchSound (0x1740)
 *   is the metronome on the vblank interrupt that decides WHEN a footstep beats, and this routine is the
 *   frame-loop bookkeeper that does the pitch-and-tempo work each beat requests. When the metronome fires
 *   a beat it raises the trigger FLEET_SOUND_STEP (0x2095); this routine, run once per frame from the main
 *   loop, notices the trigger and (a) re-chooses the march TEMPO from how thin the wave has become and
 *   (b) rotates the four-note march TONE one step. Every frame -- beat or not -- it also counts down the
 *   one-shot SFX-off timer and auto-silences a port-3 cue when it expires.
 *
 * ROLE IN THE MACHINE
 *   Called each pass of the in-game main loop (mainLoop). Reads the metronome's trigger FLEET_SOUND_STEP
 *   (0x2095) and the live-alien tally ALIEN_COUNT (0x2082, published by countLiveAliens). Writes the beat
 *   period FLEET_SOUND_PERIOD (0x2097, which stepFleetMarchSound reloads its beat timer from) and the
 *   port-5 sound-latch shadow SOUND_PORT5_SHADOW (0x2098). The tempo comes from a pair of parallel ROM
 *   tables: FLEET_RATE_THRESHOLDS (0x1a11, alien-count breakpoints) selects an index into FLEET_RATE_TABLE
 *   (0x1a21, the period bytes) -- so as aliens die the period shrinks and the march accelerates. The
 *   SFX-off auto-silence goes through clearSoundPort3Bit, which ANDs the mask into SOUND_PORT3_SHADOW and
 *   mirrors the byte to output port 3.
 *
 * Grounding: [seen] (names.js cert for 0x1775; subsystem described in mechanisms.md "Sound").
 *
 * LIVE-OUT: A -- 0 when the SFX-off timer is still running, else the byte clearSoundPort3Bit leaves in A.
 */
export function advanceFleetMarchSound(m) {
  // Only do the pitch/tempo work on a fresh beat. FLEET_SOUND_STEP is the metronome's request flag:
  // stepFleetMarchSound sets it to 1 on each footstep, and this block clears it back to 0 when serviced.
  // Between beats the trigger is 0 and we skip straight to the per-frame SFX-off tick below.
  if (m.mem8[FLEET_SOUND_STEP] !== 0) {
    // TEMPO: choose the beat period for how thin the wave has become. Walk FLEET_RATE_THRESHOLDS in
    // parallel with its index, advancing until the live-alien count is at least the current threshold,
    // then copy the matching FLEET_RATE_TABLE byte into FLEET_SOUND_PERIOD. Fewer aliens -> a smaller
    // period -> stepFleetMarchSound re-arms its beat timer sooner -> the march speeds up as the wave dies.
    const alive = m.mem8[ALIEN_COUNT];
    let i = 0;
    while (alive < m.mem8[FLEET_RATE_THRESHOLDS + i]) i++;
    m.mem8[FLEET_SOUND_PERIOD] = m.mem8[FLEET_RATE_TABLE + i];
    // TONE: rotate the single lit bit of the port-5 shadow's low nibble left one place, cycling
    // 0x01->0x02->0x04->0x08 and wrapping 0x10 back to 0x01 -- the familiar four-note descending march
    // loop. The two high sound-select bits (mask 0x30) -- one of them, bit 4 (0x10), carries the
    // saucer-hit tone -- are OR-ed back untouched, so stepping the march never clobbers a saucer-hit
    // that is still ringing.
    const shadow = m.mem8[SOUND_PORT5_SHADOW];
    const stepped = (shadow & 0x0f) << 1;
    m.mem8[SOUND_PORT5_SHADOW] = (shadow & 0x30) | (stepped === 0x10 ? 0x01 : stepped);
    // Consume the request so this beat is serviced only once.
    m.mem8[FLEET_SOUND_STEP] = 0;
  }
  // Per-frame SFX-off tick (runs whether or not a beat fired): count down the one-shot window SFX_OFF_TIMER.
  // While it is still running, leave the port alone and return A = 0. On the frame it reaches zero, mask
  // port-3 bit 4 off (0xef) through clearSoundPort3Bit, auto-silencing that one-shot cue at the end of its
  // window; that call's result byte becomes this routine's live-out A.
  m.mem8[SFX_OFF_TIMER] = m.mem8[SFX_OFF_TIMER] - 1;
  if (m.mem8[SFX_OFF_TIMER] !== 0) return (m.regs.a = 0);
  return clearSoundPort3Bit(m, 0xef);
}
