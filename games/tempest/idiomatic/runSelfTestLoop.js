// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  GAME_MODE, FRAME_COUNTER, INPUT_CUR, INPUT_EDGE_FLAGS, SPINNER_ACCUM, SPINNER_POT_PREV, DRAW_CURSOR_LO, DRAW_CURSOR_HI, SEG_SPREAD_A_LO_4,
  PENDING_WORK_FLAGS, COLOR_RAM, IN0_PORT, SELFTEST_COLOR_TABLE,
  COIN_FLIP_LATCH, AVG_GO_STROBE, WATCHDOG_CLEAR, AVG_RESET_STROBE, POKEY1_AUDCTL, POKEY1_POTGO, LED_FLIP_LATCH,
} from "./names.js";
import { armEaromReadback } from "./armEaromReadback.js";
import { queueEaromEraseAllRegions } from "./queueEaromEraseAllRegions.js";
import { loc_db0f } from "./loc_db0f.js";
import { emitHeaderedBodyRecord } from "./emitHeaderedBodyRecord.js";
import { stepEaromTransfer } from "./stepEaromTransfer.js";

// The self-test session loop. A one-time preamble seeds the state machine, forwards a pending request
// byte, copies the 8-byte colour table into colour RAM, and idles the coin/flip control; then each pass
// builds and shows one self-test frame, sampling the option switches and the diagnostic inputs, until
// the self-test switch is released. The video-sync drain touches no work RAM, so it is modelled as the
// watchdog + display-reset strobes it performs rather than as a busy-wait.
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

    loc_db0f(m);
    mem8[AVG_GO_STROBE] = emitHeaderedBodyRecord(m); // build the frame, then strobe display go

    mem8[FRAME_COUNTER] = mem8[FRAME_COUNTER] + 1;
    if ((mem8[FRAME_COUNTER] & 0x03) === 0) stepEaromTransfer(m); // every fourth frame

    if ((mem8[IN0_PORT] & 0x10) !== 0) return; // self-test switch released -> leave
  }
}
