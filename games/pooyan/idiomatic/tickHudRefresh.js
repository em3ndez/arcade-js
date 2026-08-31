// SPDX-License-Identifier: GPL-3.0-only
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { runPlayStateFrame } from "./runPlayStateFrame.js";
import { HUD_REFRESH_TICK, TAMPER_STRIKES_ROM } from "./names.js";
/**
 * tickHudRefresh — per-frame HUD-refresh tick with a tamper-gated gameplay dispatch.
 *
 * Bumps HUD_REFRESH_TICK; on a 16-frame boundary (low nibble zero) it enqueues a display-refresh
 * command (argument 0xb5 when the counter's bit 4 is set, else 0x35). Then, only while
 * the tamper-strike counter is nonzero, it falls through into the state-3 gameplay dispatcher.
 * LIVE-OUT: none (memory only).
 */
const CMD_HIGH = 0x06;
const BOUNDARY_MASK = 0x0f;
const VARIANT_BIT = 0x10;

export function tickHudRefresh(m) {
  const { mem8 } = m;
  mem8[HUD_REFRESH_TICK]++;
  const counter = mem8[HUD_REFRESH_TICK];
  if ((counter & BOUNDARY_MASK) !== 0) return; // not a 16-frame boundary
  enqueueDisplayCommand(m, (CMD_HIGH << 8) | (counter & VARIANT_BIT ? 0xb5 : 0x35));
  if (mem8[TAMPER_STRIKES_ROM] === 0) return; // dispatch gated on the strike counter
  return runPlayStateFrame(m); // fall through into the state-3 dispatch + continuation
}
