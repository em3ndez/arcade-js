// SPDX-License-Identifier: GPL-3.0-only
import { queueSoundCommands96And97And18And15 } from "./queueSoundCommands96And97And18And15.js";
import { queueSoundCommands19And15 } from "./queueSoundCommands19And15.js";
import { queueSirenSoundRun } from "./queueSirenSoundRun.js";
import {
  PERIODIC_MODE_LATCH,
  SPAWN_PHASE_COUNTER,
  GRAB_ACTIVE_FLAG,
  SIREN_ENABLE_GATE,
  WAVE_EVENT_LATCH,
  WAVE_TEARDOWN_STATE,
  PERIODIC_EVENT_TIMER,
} from "./names.js";
/**
 * loc_196e — gated periodic driver for the warning-siren arm and a shared event countdown.
 *
 * Returns immediately while the mode latch is non-zero. The spawn-phase value selects a mode:
 * below five falls straight to the shared tail; exactly five arms a two-cell pair (the siren gate
 * when the grab flag is clear, otherwise the caller-supplied pair) and fires the mode-five sound
 * run when that pair's first cell is free; above five records the value in the mode latch and fires
 * the higher-mode sound run when the grab flag is clear. The shared tail returns if either the wave
 * event latch or the wave-teardown state is set; otherwise it runs an event countdown that, on
 * expiry, reloads, sets the wave event latch, and fires the siren-tile run.
 *
 * LIVE-OUT: memory only. The caller runs it as one of a sequence and reads no register back.
 */

const TIMER_RELOAD = 0x20; // event-countdown reload value

export function loc_196e(m, hl = m.regs.hl) {
  const { mem8 } = m;

  if (mem8[PERIODIC_MODE_LATCH] !== 0) return; // driver busy

  const mode = mem8[SPAWN_PHASE_COUNTER];
  if (mode === 0x05) {
    let pair = mem8[GRAB_ACTIVE_FLAG] === 0 ? SIREN_ENABLE_GATE : hl;
    if (mem8[pair] === 0) { // first cell free -> arm the pair and fire the run
      mem8[pair] = 0x01;
      pair = (pair - (pair & 0xff)) + ((pair + 2) & 0xff); // keep the page, step the low byte by two
      mem8[pair] = 0x01;
      queueSoundCommands96And97And18And15(m);
    }
  } else if (mode > 0x05) {
    mem8[PERIODIC_MODE_LATCH] = mode; // latch the mode
    if (mem8[GRAB_ACTIVE_FLAG] === 0) queueSoundCommands19And15(m);
  }

  if (mem8[WAVE_EVENT_LATCH] !== 0) return;
  if (mem8[WAVE_TEARDOWN_STATE] !== 0) return;

  if (mem8[PERIODIC_EVENT_TIMER] === 0) { // expired -> reload, latch, draw
    mem8[PERIODIC_EVENT_TIMER] = TIMER_RELOAD;
    mem8[WAVE_EVENT_LATCH] = 0x01;
    queueSirenSoundRun(m);
    return;
  }
  mem8[PERIODIC_EVENT_TIMER] = (mem8[PERIODIC_EVENT_TIMER] - 1); // tick down
}
