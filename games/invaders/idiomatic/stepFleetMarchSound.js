// SPDX-License-Identifier: GPL-3.0-only
import { FLEET_SOUND_OFF_TIMER, loc_2068, FLEET_SOUND_TIMER, FLEET_SOUND_PERIOD, FLEET_SOUND_STEP, SOUND_PORT5_SHADOW, ALIEN_COUNT } from "./names.js";
import { silenceFleetMarchNote } from "./silenceFleetMarchNote.js";

/**
 * stepFleetMarchSound — the fleet-march metronome (the "footsteps").
 *
 * WHAT IT IS
 *   The interrupt-side half of the fleet march. Run each tick from the vblank handler (0x0010) while a
 *   game is in progress, it turns the march's four-note loop into discrete footsteps: it cuts the note
 *   off after a few ticks, and on each beat it sounds the current tone (port 5) and re-arms the beat.
 *   Its frame-loop partner advanceFleetMarchSound does the pitch/tempo work this routine requests.
 *
 * ROLE IN THE MACHINE
 *   Port 5 carries the fleet march; the game keeps its latch in SOUND_PORT5_SHADOW (0x2098) and mirrors
 *   the whole byte out. FLEET_SOUND_OFF_TIMER (0x209b) is the note-off countdown; silenceFleetMarchNote
 *   re-emits only the two high bits (mask 0x30), muting the four low march tones so each step is a
 *   discrete note. loc_2068 is an enable flag (clear -> silence and stop). FLEET_SOUND_TIMER (0x2096)
 *   is the beat countdown; on the beat it writes the full shadow (sounding the tone), and — provided
 *   ALIEN_COUNT (0x2082) is nonzero — reloads the beat from FLEET_SOUND_PERIOD (0x2097), sets the
 *   trigger FLEET_SOUND_STEP (0x2095) that tells advanceFleetMarchSound to step pitch/tempo, and arms
 *   the note-off timer to 4. When the last alien is gone the beat plays but nothing re-arms, so the
 *   march goes quiet.
 *
 * ROM 0x1740-...  Grounding: [seen].  (loc_2068 keeps a placeholder name.)
 *
 * LIVE-OUT: memory + the port-5 sound latch.
 */
export function stepFleetMarchSound(m) {
  // Tick the note-off countdown; when it hits zero, cut the current note (leave only the high latch bits).
  m.mem8[FLEET_SOUND_OFF_TIMER] = m.mem8[FLEET_SOUND_OFF_TIMER] - 1;
  if (m.mem8[FLEET_SOUND_OFF_TIMER] === 0) silenceFleetMarchNote(m);
  // March disabled (enable flag clear): silence and stop for this tick.
  if (m.mem8[loc_2068] === 0) return silenceFleetMarchNote(m);
  // Tick the beat countdown; until it expires there is no footstep this tick.
  m.mem8[FLEET_SOUND_TIMER] = m.mem8[FLEET_SOUND_TIMER] - 1;
  if (m.mem8[FLEET_SOUND_TIMER] !== 0) return;
  // Beat: sound the current tone by mirroring the whole port-5 shadow out.
  m.io.portOut(0x05, m.mem8[SOUND_PORT5_SHADOW]);
  // Last alien gone: play this final beat but do not re-arm, so the march falls silent from here.
  if (m.mem8[ALIEN_COUNT] === 0) return silenceFleetMarchNote(m);
  // Re-arm the next beat from the tempo period (set per fleet size by advanceFleetMarchSound).
  m.mem8[FLEET_SOUND_TIMER] = m.mem8[FLEET_SOUND_PERIOD];
  // Ask advanceFleetMarchSound (frame loop) to step the pitch nibble and refresh the tempo next frame.
  m.mem8[FLEET_SOUND_STEP] = 0x01;
  // Ring this note for four ticks before the note-off timer cuts it.
  m.mem8[FLEET_SOUND_OFF_TIMER] = 0x04;
}
