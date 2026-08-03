// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2c7b — pick a bonus-event slot-claim cluster entry by testing the caller's stepped
 * value against the bonus.  ROM 0x2C7B.
 *
 * One of the entry points that resolve into the bonus-event slot-claim cluster (0x2C41). The
 * caller — still the frozen oracle (scheduleBarrelRelease, reached by a tail jump) — hands in two register
 * live-ins: a small stepped value and the current bonus value. This routine steps that value up
 * by two and compares it with the bonus, and the outcome selects which cluster entry runs and
 * therefore which mode byte the cluster records:
 *
 *   - stepped+2 == bonus  -> the mode-byte-1 entry (loc_2c49): records BARREL_CLAIM_MODE = 1,
 *                            0x638F = 2 and forwards the bonus (the same live-in) so the shared
 *                            body's event gate can run.
 *   - otherwise           -> the shared entry with mode byte 2 (loc_2c4b): records
 *                            BARREL_CLAIM_MODE = 2, 0x638F = 3, again forwarding the bonus.
 *
 * Both arms tail into the same slot-claim chain (armBarrelRelease -> markNextBarrelAsAltKind); nothing here consumes a
 * return value, so this is void. The comparison is taken at byte width because the step-up wraps
 * (a stepped value of 254/255 lands on 0/1), and that wrap flips the branch when the bonus is 0/1.
 *
 * GROUNDED — observed live in MAME 0.288 on the real dkong ROM (understanding pass 12,
 * scratchpad/pass12-grounding.md): what the chain below ultimately tags is a 25m BARREL. On a
 * claim, markNextBarrelAsAltKind raises bit 7 of BARREL_CLAIM_MODE, and one frame later stampReleasedBarrelKind reads that bit
 * to choose which of two barrel kinds it stamps into the freshly-released OBJ_ARRAY_67 record —
 * bit 7 CLEAR -> sprite code/attr/mode 0x15 / 0x0B / 0x00, bit 7 SET -> 0x19 / 0x0C / 0x01,
 * agreeing 46/46 with no exceptions (38 clear, 8 set), every dispatch ordinary board-1 25m
 * gameplay and ZERO in the opening Kong-climb cutscene. The bit-7-SET (attr 0x0C) kind DROPS with
 * its X pinned at 59; the bit-7-CLEAR (attr 0x0B) kind ROLLS along the girders. Grounding
 * deliberately did NOT establish which NAMED Donkey Kong object either kind is.
 *
 * ★ REACHABILITY — A FALSE CLAIM IN THIS HEADER, CORRECTED (pass 13). An earlier version said "this
 * entry is NOT reached during attract ... so there are no real captured dispatches". That was
 * FALSE. On the real dkong ROM under MAME 0.288, in PURE attract (zero coins, zero inputs, zero
 * pokes, 24,243 frames, positive control 24,212 NMI fetches), an opcode-fetch tap counted 0x2C03
 * firing 9843 times and 0x2C7B firing 18 — reproduced independently by a second rig, and 24 times
 * in a credited run. The dispatches are EXACTLY TWO PER 25m BOARD, at BONUS = BONUS_START (50) and
 * BONUS_START − 1 (49), precisely what this routine's own guard predicts (scheduleBarrelRelease tail-jumps here
 * while BONUS_START − 2 < BONUS, which with BONUS_START = 50 is true at 50 and 49 and false from 48
 * down). See scratchpad/pass13-grounding.md §3.
 * HONEST FLOOR from that run: only the ENTRY was tapped. The two BRANCH ARMS were not separated —
 * targets 0x2C49 / 0x2C4B were not tapped this pass — so the reachability question is settled while
 * the per-arm split is not. That is why the gate below stays crafted+exhaustive rather than
 * capture-driven: the crafted sweep is what covers both arms, not a claim that captures are
 * unavailable.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2c7b.test.js.
 * GATE:     crafted-entry + exhaustive. NOT because captures are unavailable — this entry IS
 *           naturally dispatched (18x in 400 s of pure attract, 24x in a credited run; see the
 *           reachability note above) — but because 18 dispatches all land on the same two BONUS
 *           values and the entry tap did not separate the two branch arms. The crafted sweep is
 *           therefore what provides arm coverage: exhaustive over the branch decision (all 256
 *           stepped-value inputs x taken/not-taken, incl. the +2 wrap) with the event gate held
 *           closed to isolate the mode-byte writes, plus a gate-open slot cross-product in BOTH
 *           branches (every first-free-slot position and the all-occupied case, at several marks
 *           incl. a low one whose -8 step wraps). No captured dispatch is replayed here, so the
 *           gate makes no real-capture coverage claim. Teeth: a compare that drops the byte-width
 *           wrap, a wrong constant mode byte, and a mis-forwarded bonus.
 * LIVE-OUT: memory-only — everything the chosen cluster entry writes (BARREL_CLAIM_MODE, 0x638F,
 *           0x6392, BONUS_EVENT_MARK, and a slot claim's bit 7 on BARREL_CLAIM_MODE). The
 *           still-oracle caller reloads its registers; nothing reads a register or flag this
 *           routine leaves behind.
 * NAMES:    loc_2c49 (ROM 0x2C49) and loc_2c4b (ROM 0x2C4B) direct-called with honest args (the
 *           constant mode byte 2 that the oracle loads before the mode-byte-2 arm becomes loc_2c4b's
 *           mode argument). This routine writes no RAM itself. The bonus live-in it forwards is the
 *           value BONUS (0x62B1) holds, read here from a register at the still-translated caller
 *           boundary. BARREL_CLAIM_MODE (0x6382) — the barrel slot-claim mode byte whose low bits
 *           carry the mode value and whose bit 7 selects the barrel kind — is named in ram.js and
 *           imported inside the callees; 0x638F/0x6392 stay unnamed 0x63xx engine scratch and carry
 *           their comments there too.
 */

import { u8 } from "../../../core/int.js";
import { loc_2c49 } from "./loc_2c49.js"; // ROM 0x2C49 — the mode-byte-1 entry (forwards the bonus)
import { loc_2c4b } from "./loc_2c4b.js"; // ROM 0x2C4B — the shared entry (mode byte taken as an arg)

const MODE_BYTE_2 = 0x02; // the constant mode byte the oracle loads before the mode-byte-2 arm

/**
 * @param {object} m  the machine (reads the stepped value and the bonus from registers).
 * @returns {void}
 */
export function loc_2c7b(m) {
  const { regs } = m;

  // Step the caller's value up by two (at byte width — it wraps) and test it against the bonus.
  const probe = u8(regs.a + 0x02);
  const bonus = regs.c;

  if (probe === bonus) {
    // Match: the mode-byte-1 entry, which forwards the bonus (still in the same register) itself.
    loc_2c49(m);
  } else {
    // Miss: the shared entry with mode byte 2, forwarding the bonus explicitly.
    loc_2c4b(m, MODE_BYTE_2, bonus);
  }
}
