// SPDX-License-Identifier: GPL-3.0-only
import { FLEET_SOUND_OFF_TIMER, loc_2068, FLEET_SOUND_TIMER, FLEET_SOUND_PERIOD, FLEET_SOUND_STEP, SOUND_PORT5_SHADOW, ALIEN_COUNT } from "./names.js";
import { silenceFleetMarchNote } from "./silenceFleetMarchNote.js";

// Per-frame fleet-march sound beat: tick the note-off/beat timers, sound the port-5 fleet tone on the beat and re-seed it.
export function stepFleetMarchSound(m) {
  m.mem8[FLEET_SOUND_OFF_TIMER] = m.mem8[FLEET_SOUND_OFF_TIMER] - 1;
  if (m.mem8[FLEET_SOUND_OFF_TIMER] === 0) silenceFleetMarchNote(m);
  if (m.mem8[loc_2068] === 0) return silenceFleetMarchNote(m);
  m.mem8[FLEET_SOUND_TIMER] = m.mem8[FLEET_SOUND_TIMER] - 1;
  if (m.mem8[FLEET_SOUND_TIMER] !== 0) return;
  m.io.portOut(0x05, m.mem8[SOUND_PORT5_SHADOW]);
  if (m.mem8[ALIEN_COUNT] === 0) return silenceFleetMarchNote(m);
  m.mem8[FLEET_SOUND_TIMER] = m.mem8[FLEET_SOUND_PERIOD];
  m.mem8[FLEET_SOUND_STEP] = 0x01;
  m.mem8[FLEET_SOUND_OFF_TIMER] = 0x04;
}
