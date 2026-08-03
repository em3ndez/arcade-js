// SPDX-License-Identifier: GPL-3.0-only
/**
 * resetScoreCounter — zero one of the three score counters, then repaint it via the
 * score-draw task.  ROM 0x059B.
 *
 * Task-table entry 2, dispatched from the main-loop task ring (the task's second byte
 * arrives as the payload in the same register drawScoreTask reads). It RESETS one of the
 * three on-screen score counters to zero and repaints it. The payload picks which:
 *   • payload 0 — player 1's score;
 *   • payload 2 — the high score;
 *   • anything else below 3 (i.e. 1) — player 2's score.
 *
 * Each score is a 3-byte little-endian packed-BCD counter. This routine zeroes all three
 * bytes of the selected counter, then hands off to drawScoreTask — the same
 * select-a-score-and-render task — which repaints that counter (now showing 000000) up
 * its column. It is drawScoreTask's clear-first twin: identical payload→counter
 * selection, but it BLANKS the counter before rendering. That is the score RESET that
 * happens when a game starts (it never fires in attract, which only redraws).
 *
 * The payload-3-and-up arm jumps to a separate ROM routine (0x05BD) that recursively
 * clears the lower counters as well; it is never enqueued in play (the game only ever
 * raises payloads 0–2) and was never lifted, so — exactly as the frozen oracle does, and
 * mirroring drawScoreTask stubbing its own high-payload arm — it surfaces as a loud fault
 * rather than a silent wrong clear.
 *
 * REGISTER-ABI: drawScoreTask still takes its selecting payload in a register (a genuine
 * task-ring boundary, not yet promotable to a parameter), so the payload is left in place
 * — untouched by the clear — as its input, in the same register the task ring delivered it.
 *
 * Promoted from loc_059b (DK understanding pass 10, independent proposer≠confirmer, HIGH):
 * the clear-then-repaint MECHANISM is pinned to the oracle and it operates only on the rated
 * P1_SCORE / P2_SCORE / HIGH_SCORE cells — it is drawScoreTask's clear-first twin (same
 * payload→counter select), zeroing the three BCD bytes before rendering. The name states the
 * mechanism exactly.
 *
 * Memory-equivalent to the frozen oracle — equivalence-059b.test.js.
 * GATE:     crafted-entry, grounded in a real captured dispatch. resetScoreCounter never fires in
 *           attract (it is the score RESET, not the per-frame redraw), so it is driven
 *           once at game start by the coin+start tape (payload 0 → P1_SCORE), which
 *           grounds the player-1 arm; crafted entries then force the player-2 arm
 *           (payload 1) and the high-score arm (payload 2) identically on both sides over
 *           distinct seeded counters, and confirm the payload-3-and-up arm faults on both
 *           sides. Compared over RAM (minus STACK_SCRATCH) + pc + SP. The renderer chain
 *           is all tail-jumps ending in one caller-return `ret`, so the candidate models
 *           it with a single trailing return; the oracle's balanced push/pop of the
 *           payload and the renderer's per-digit push/pop live in STACK_SCRATCH, excluded
 *           by the contract. Teeth: a twin that clears the wrong counter and a twin that
 *           lands a nonzero byte in the clear.
 * LIVE-OUT: memory-only — the three cleared counter bytes plus the digit cells the
 *           renderer paints into video RAM. The task returns to the top of the main loop,
 *           which reloads its registers, so the oracle's residual registers/flags (and its
 *           balanced payload push/pop) are dead.
 * NAMES:    P1_SCORE (0x60B2), P2_SCORE (0x60B5), HIGH_SCORE (0x60B8) from ram.js — the
 *           three 3-byte counters, selected by payload 0 / other / 2. drawScoreTask
 *           (ROM 0x05C6) is direct-called; the destination columns are owned by it.
 */

import { P1_SCORE, P2_SCORE, HIGH_SCORE } from "./ram.js";
import { drawScoreTask } from "./drawScoreTask.js"; // ROM 0x05C6 — select-a-score-and-render task
import { NotImplemented } from "../../../boards/dkong/io.js";

export function resetScoreCounter(m) {
  const { regs, mem } = m;
  const payload = regs.a;

  // Payload 3-and-up -> the un-lifted recursive "clear the lower counters too" arm at
  // ROM 0x05BD. Never enqueued in play; faulted loudly rather than mis-cleared, matching
  // the oracle (and its twin drawScoreTask, which stubs its own high-payload arm).
  if (payload >= 3) {
    throw new NotImplemented(
      "resetScoreCounter payload>=3 recursion at ROM 0x05BD (twin-consistent stub; see the header)",
    );
  }

  // Select the 3-byte packed-BCD counter this task resets, by payload:
  //   0 -> player 1, 2 -> high score, anything else (1) -> player 2.
  const base = payload === 0 ? P1_SCORE : payload === 2 ? HIGH_SCORE : P2_SCORE;

  // Zero the whole counter (base, base+1, base+2) so it repaints as 000000.
  mem.write8(base, 0);
  mem.write8(base + 1, 0);
  mem.write8(base + 2, 0);

  // Repaint the now-cleared counter. drawScoreTask reads the selecting payload from the
  // same register it arrived in (left untouched by the clear); it points the source at the
  // counter's most-significant pair and renders the six digits up the counter's column.
  drawScoreTask(m);
}
