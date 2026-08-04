// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceBarrelRelease — the frame-gated step of the 0x2C-cluster string/sprite renderer.  ROM 0x2D15.
 *
 * Reached by fall-through from the cluster's setup head (stampReleasedBarrelKind) and by a couple of
 * conditional tail-jumps from its neighbours. Runs once per renderer tick but only DOES
 * anything every 0x18 frames: a down-counter at FRAME_GATE (0x62AF) is decremented every
 * entry and the routine returns until it underflows.
 *
 * GROUNDED — observed live in MAME 0.288 on the real dkong ROM (understanding pass 12,
 * scratchpad/pass12-grounding.md). This chain is ORDINARY 25m BARREL PLAY, not a cutscene:
 * an earlier version of this header called it "the intro string/sprite renderer" and cited
 * "the 0x2C-cluster cutscene setup", and BOTH are REFUTED. All 46 captured dispatches of the
 * head stampReleasedBarrelKind fell at gameplay substates (17 in a credited in-board 25m game, 29 in the
 * attract 25m demo) and ZERO at substate 7, the opening Kong-climb cutscene; the record being
 * dressed is always an OBJ_ARRAY_67 barrel record, one per slot claim by the barrel-release
 * routine (board 1, ROM 0x2CB8). This routine is likewise BOARD-1 ONLY and runs per tick:
 * 1040 fetches in a 4243-frame attract run and 1826 in a credited 25m game, against 0 across
 * 6667 frames each of poked 50m and 75m.
 *
 * On the acting frame it reloads the gate to 0x18 and reads a sub-counter at
 * ANIM_COUNTER (0x638F):
 *   - Sub-counter zero -> just render the next character (tail into loc_2d51).
 *   - Sub-counter non-zero -> select a 40-byte record from the ROM animation table at
 *     ANIM_TABLE (0x3932). bit0 of BARREL_CLAIM_MODE chooses whether the record
 *     index is the sub-counter itself (bit set) or one less (bit clear); the record is
 *     copied into the sprite-object block by loadSpriteObjectBlock. The sub-counter is
 *     then stepped down: while it stays non-zero, render the next character (loc_2d51);
 *     when it reaches zero, shorten the gate to a single frame and branch on the same
 *     parity bit — set restarts the fixed source string (loc_2d83), clear renders the
 *     next character (loc_2d51).
 *
 * REGISTER-ABI MARSHALLING (dissolves once loadSpriteObjectBlock takes an honest source
 * param): loadSpriteObjectBlock reads its copy SOURCE from the pointer register, so this
 * routine loads exactly what the oracle's `call 0x004e` site leaves there — the table
 * record address ANIM_TABLE + 40*index. loc_2d51 and loc_2d83 read no incoming register
 * (each reloads its own cursor), so the tail-jumps need no marshalling.
 *
 * NAME: kept loc_ — the mechanics (frame gate, table select, sub-counter step, branch) are
 * pinned to the oracle, and grounding now fixes the CONTEXT (25m barrel play, board 1). What
 * is still open is the NAMED identity of the two barrel kinds the head selects between, which
 * the grounding run deliberately did not establish, so an English name would have to guess.
 * Promote once that is corroborated.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2d15.test.js.
 * GATE:     real captured 0x2D15 dispatches from attract (the frame-gate-return path and
 *           whatever acting paths occur naturally) plus crafted entries, poked identically
 *           on both sides, that force every path: frame-gate return, sub-counter-zero,
 *           the table-load arm with the parity bit both ways, and the sub-counter-underflow
 *           branch into loc_2d83 (parity set) and loc_2d51 (parity clear). The RAM diff
 *           excludes the dead STACK_SCRATCH the dissolved `call 0x004e` bracket churns.
 *           Teeth: a twin that skips the gate reload and a twin that drops the ±1 record
 *           adjust.
 * LIVE-OUT: memory-only. The oracle's residual registers/flags and its single net terminal
 *           `ret` (each path either `ret`s or tail-jumps into a callee that `ret`s on this
 *           routine's behalf) are dead ABI — the caller reads none of them; that one return
 *           is modelled in the gate, not here.
 * NAMES:    BARREL_CLAIM_MODE (0x6382) from names.js — the barrel slot-claim mode byte; its low
 *           bits carry the claim's mode value (observed 1, and 0x81 = mode 1 with bit 7 set),
 *           its bit 7 selects the barrel kind for stampReleasedBarrelKind, and THIS routine reads its bit 0.
 *           FRAME_GATE (0x62AF) and ANIM_COUNTER (0x638F) were each examined and left UNNAMED
 *           in names.js (thin/shared engine scratch), so each stays a local hex const here;
 *           ANIM_TABLE (0x3932) is a ROM address (the table data), kept as a hex const.
 *           loadSpriteObjectBlock fills SPRITE_OBJ_BLOCK (0x6908).
 */

import { BARREL_CLAIM_MODE } from "./names.js"; // ROM 0x6382 — bit 0 read here; bit 7 is the kind select
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js"; // ROM 0x004E
import { loc_2d51 } from "./loc_2d51.js"; // ROM 0x2D51 — render the next character
import { loc_2d83 } from "./loc_2d83.js"; // ROM 0x2D83 — (re)start the fixed source string

const FRAME_GATE = 0x62af;     // per-tick down-counter; acts every 0x18 frames
const ANIM_COUNTER = 0x638f;   // animation sub-counter: selects the record and counts down
const ANIM_TABLE = 0x3932;     // ROM base of the 40-byte-per-record animation table
const RECORD_STRIDE = 40;      // bytes per table record (0x28 = 10 sprite records x 4)

export function advanceBarrelRelease(m) {
  const { regs, mem } = m;

  // Frame gate: decrement every entry; return until it underflows to zero.
  const gate = (mem.read8(FRAME_GATE) - 1) & 0xff;
  mem.write8(FRAME_GATE, gate);
  if (gate !== 0) return; // not this frame's turn

  // Acting frame: reload the gate for the next cycle.
  mem.write8(FRAME_GATE, 0x18);

  // Zero sub-counter -> render the next character directly.
  const counter = mem.read8(ANIM_COUNTER);
  if (counter === 0) return loc_2d51(m);

  // Select the animation-table record. bit0 of the slot-claim mode byte decides whether the
  // record index is the sub-counter itself or one less; index*40 is taken 8-bit.
  let index = counter;
  if ((mem.read8(BARREL_CLAIM_MODE) & 0x01) === 0) {
    index = (index - 1) & 0xff;
  }
  const source = (ANIM_TABLE + ((index * RECORD_STRIDE) & 0xff)) & 0xffff;

  // Copy that 40-byte record into the sprite-object block. loadSpriteObjectBlock reads
  // its source pointer from the pointer register, so hand it the record address.
  regs.hl = source;
  loadSpriteObjectBlock(m); // ROM 0x004E -> SPRITE_OBJ_BLOCK (0x6908)

  // Step the sub-counter. While it stays non-zero, render the next character.
  const stepped = (mem.read8(ANIM_COUNTER) - 1) & 0xff;
  mem.write8(ANIM_COUNTER, stepped);
  if (stepped !== 0) return loc_2d51(m);

  // Sub-counter reached zero: shorten the gate to one frame, then branch on that same bit 0
  // — set restarts the fixed source string, clear renders the next character.
  mem.write8(FRAME_GATE, 0x01);
  if ((mem.read8(BARREL_CLAIM_MODE) & 0x01) !== 0) return loc_2d83(m);
  return loc_2d51(m);
}
