// SPDX-License-Identifier: GPL-3.0-only
/**
 * pickAwardTierByObjectCount — pick one of three effect-sprite parameter pairs from the low bits of A,
 * then hand off to the Mario-anchored record-stamp tail loc_1e28.  ROM 0x3e70.
 *
 * A setter in the sub_1dbd (0x6340) effect-sprite state machine, and the direct sibling
 * of stageAward300Popup / stageAward500Popup / stageAward800Popup — each loads its own (DE, B) and tail-jumps into a
 * shared stamp routine. Its caller armScorePopupAndSelectAward tail-jumps here when 0x6342 bit 0 is set,
 * leaving A holding 0x6342 already shifted right once. This routine is a small priority
 * encoder over A's two low bits:
 *
 *   - A bit 0 clear            -> (DE=0x0001, B=0x7B)
 *   - else A bit 1 clear       -> (DE=0x0003, B=0x7D)
 *   - else                     -> (DE=0x0005, B=0x7F)
 *
 * (The oracle walks the bits with a chain of `rra` — carry = bit 0, then bit 1 — and the
 * "first clear low bit wins" is exactly this if/else-if. B and E are correlated: B = E + 0x7A.)
 * DE is the deferred task message (D=opcode 0, E=argument 1/3/5) and B is the effect
 * sprite's code byte; both are the tail's parameters. loc_1e28 then enqueues the task,
 * stamps the 4-byte record {MARIO_X, B, 0x07, MARIO_Y+0x14} at 0x6A30, and cues a
 * board-gated sound (0x6085=3).
 *
 * The oracle's `rra` also ROTATES A (and sets flags), but those are DEAD into loc_1e28:
 * its first callee sub_309f reads only D/E/HL/TASK_TAIL, and loc_1e28 then overwrites A
 * with `ld a,(0x6205)` and re-sets the flags before any memory-affecting use. So the
 * rotation is dropped here — A/F entering loc_1e28 differ from the oracle's transiently
 * and reconverge (loc_1e28 re-derives both), leaving memory, SP and pc byte-identical.
 *
 * NAME: kept the neutral loc_ — the mechanics are understood, but the specific effect
 * this sprite is (and thus a meaningful English name) is not confirmed to the routine-name
 * bar. Its sibling setters stageAward300Popup/1e08/1e10 and the analogous feeder stageAwardPopupAtHitObject all stayed
 * neutral for the same reason, and its own tail loc_1e28 is still the frozen oracle;
 * promoting the setter past its tail would overclaim. Promote once corroborated.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3e70.test.js.
 * GATE:     crafted-entry — oracle-vs-idiomatic on real captured 25m dispatches (BOARD 1;
 *           attract only ever reaches arm 1, A=0x00), plus an EXHAUSTIVE A-sweep 0..255 on a
 *           real base that crafts arms 2 and 3 attract never reaches (all three arms hit).
 *           Two teeth: a bit-order swap and a wrong param byte, both caught by the sweep.
 * LIVE-OUT: memory-only — the enqueued task + TASK_TAIL, the sprite record 0x6A30..0x6A33,
 *           and the gate-open 0x6085 (all via loc_1e28). The caller reads no register after
 *           this tail. (A/F/DE/B are set only as loc_1e28's live-in and are consumed within
 *           this same dispatch.) SP/pc move with the still-oracle loc_1e28 tail and match it
 *           exactly; they become dead-stack once loc_1e28 is itself decompiled.
 * NAMES:    none in this body — it reads only register A and writes registers DE/B. loc_1e28
 *           (ROM 0x1E28) is the callee, imported from translated/ (the frozen oracle, not yet
 *           decompiled) and called directly; loc_1e28 owns all the RAM writes and ram.js names.
 */
// ROM 0x1E28 — the FROZEN ORACLE tail, deliberately. An idiomatic twin (awardScorePopup.js)
// exists and 0x1E28 is in ram.js's ROUTINES, so "no idiomatic yet" would be false. The oracle
// ends in a `ret` that returns on this routine's behalf; the twin returns in JS and leaves SP at
// entry. MEASURED — swapping it fails this routine's own equivalence gate with a contract diff
// at SP (oracle 0x6BF0 vs idiomatic 0x6BEE) on the arm that reaches it.
import { loc_1e28 } from "../translated/loc_1e28.js";

export function pickAwardTierByObjectCount(m) {
  const { regs } = m;

  // First clear low bit of A selects the (DE, B) parameter pair.
  if ((regs.a & 0x01) === 0) {
    regs.de = 0x0001;
    regs.b = 0x7b;
  } else if ((regs.a & 0x02) === 0) {
    regs.de = 0x0003;
    regs.b = 0x7d;
  } else {
    regs.de = 0x0005;
    regs.b = 0x7f;
  }

  // Tail into the Mario-anchored task-enqueue + record-stamp (frozen oracle).
  loc_1e28(m);
}
