// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  GAME_MODE, FRAME_COUNTER, INPUT_CUR, INPUT_EDGE_FLAGS, SPINNER_ACCUM, SPINNER_POT_PREV, DRAW_CURSOR_LO, DRAW_CURSOR_HI, SEG_SPREAD_A_LO_4,
  PENDING_WORK_FLAGS, COLOR_RAM, IN0_PORT, SELFTEST_COLOR_TABLE,
  COIN_FLIP_LATCH, AVG_GO_STROBE, WATCHDOG_CLEAR, AVG_RESET_STROBE, POKEY1_AUDCTL, POKEY1_POTGO, LED_FLIP_LATCH,
} from "./names.js";
import { armEaromReadback } from "./armEaromReadback.js";
import { queueEaromEraseAllRegions } from "./queueEaromEraseAllRegions.js";
import { dispatchDrawHandler } from "./dispatchDrawHandler.js";
import { emitHeaderedBodyRecord } from "./emitHeaderedBodyRecord.js";
import { stepEaromTransfer } from "./stepEaromTransfer.js";

/**
 * runSelfTestLoop — the operator self-test session loop. ROM 0xda62.
 *
 * Role in the machine: when the cabinet's self-test switch is held, Tempest leaves normal play and runs a
 * diagnostic session that draws test patterns and reports the option-DIP settings and input states on the
 * vector monitor. This routine is that session: a one-time preamble that seeds the mode state machine and
 * screen, followed by an unbounded per-frame loop that builds and shows one diagnostic frame at a time
 * until the operator releases the switch. It sits directly after the power-on ROM checksum
 * (checksumRomAndSettleEntropy tail-continues here).
 *
 * Preamble: arm the EAROM readback (armEaromReadback), then branch on the pending-work byte
 * PENDING_WORK_FLAGS. If it is zero, set GAME_MODE = 2 (plain self-test). If nonzero, stash it into
 * SEG_SPREAD_A_LO_4, queue an erase of every EAROM region (queueEaromEraseAllRegions), clear the pending
 * byte, and set GAME_MODE = 0. Then copy the 8-byte SELFTEST_COLOR_TABLE into COLOR_RAM, blank the LED
 * flip latch, and idle the coin/flip control with COIN_FLIP_LATCH = 0x10.
 *
 * Per-frame loop: strobe WATCHDOG_CLEAR and AVG_RESET_STROBE (both value-ignoring); reset the draw cursor
 * to 0x2000 (DRAW_CURSOR_LO/HI); kick a POKEY pot scan (POKEY1_POTGO) and read the option switches back
 * from POKEY1_AUDCTL into SPINNER_POT_PREV, keeping the low nibble in SPINNER_ACCUM. Read IN0_PORT,
 * invert it, and mask 0x2f into INPUT_EDGE_FLAGS; if none of the two diagnostic-select bits (0x28) are
 * set, reset INPUT_CUR to 0x20, else shift INPUT_CUR left one and, when the bit shifted out of the top was
 * set, double-bump GAME_MODE by 2 (advancing the diagnostic page). Build and show the frame via
 * dispatchDrawHandler + emitHeaderedBodyRecord (whose return strobes AVG_GO_STROBE to launch the display).
 * Tick FRAME_COUNTER and, every fourth frame, service one EAROM transfer step (stepEaromTransfer). The
 * loop returns the moment IN0_PORT bit 4 shows the self-test switch released. The real board also busy-
 * waits on video sync here; that drain touches no work RAM, so it is modelled purely as the watchdog +
 * display-reset strobes it performs rather than as a spin.
 *
 * Live-out: GAME_MODE (the entered diagnostic page), COLOR_RAM (test palette), the POKEY/latch strobes,
 * INPUT_EDGE_FLAGS / INPUT_CUR / SPINNER_* sample cells, FRAME_COUNTER, and any queued EAROM erase/transfer
 * work; returns on switch release. Grounding: [seen].
 */
export function runSelfTestLoop(m) {
  const { mem8 } = m;

  // ---- one-time preamble ----
  armEaromReadback(m);
  const pending = mem8[PENDING_WORK_FLAGS];
  if (pending === 0) {
    mem8[GAME_MODE] = 2;
  } else {
    mem8[SEG_SPREAD_A_LO_4] = pending;
    queueEaromEraseAllRegions(m);
    mem8[PENDING_WORK_FLAGS] = 0;
    mem8[GAME_MODE] = 0;
  }
  for (let i = 7; i >= 0; i--) mem8[COLOR_RAM + i] = mem8[u16(SELFTEST_COLOR_TABLE + i)];
  mem8[LED_FLIP_LATCH] = 0;
  mem8[COIN_FLIP_LATCH] = 0x10;

  // ---- per-frame self-test loop ----
  for (;;) {
    mem8[WATCHDOG_CLEAR] = 0; // watchdog clear (value-ignoring strobe)
    mem8[AVG_RESET_STROBE] = 0; // display reset (value-ignoring strobe)

    mem8[DRAW_CURSOR_LO] = 0;
    mem8[DRAW_CURSOR_HI] = 0x20;
    mem8[POKEY1_POTGO] = 0x20;
    const options = mem8[POKEY1_AUDCTL];
    mem8[SPINNER_POT_PREV] = options;
    mem8[SPINNER_ACCUM] = options & 0x0f;

    const active = (mem8[IN0_PORT] ^ 0xff) & 0x2f;
    mem8[INPUT_EDGE_FLAGS] = active;
    if ((active & 0x28) === 0) {
      mem8[INPUT_CUR] = 0x20;
    } else {
      const packed = mem8[INPUT_CUR];
      mem8[INPUT_CUR] = packed << 1;
      if ((packed & 0x80) !== 0) mem8[GAME_MODE] = mem8[GAME_MODE] + 2; // top bit shifted out -> double-bump
    }

    dispatchDrawHandler(m);
    mem8[AVG_GO_STROBE] = emitHeaderedBodyRecord(m); // build the frame, then strobe display go

    mem8[FRAME_COUNTER] = mem8[FRAME_COUNTER] + 1;
    if ((mem8[FRAME_COUNTER] & 0x03) === 0) stepEaromTransfer(m); // every fourth frame

    if ((mem8[IN0_PORT] & 0x10) !== 0) return; // self-test switch released -> leave
  }
}
