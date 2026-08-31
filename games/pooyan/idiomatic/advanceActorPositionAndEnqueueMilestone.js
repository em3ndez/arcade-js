// SPDX-License-Identifier: GPL-3.0-only
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { u8 } from "../../../core/int.js";
/**
 * advanceActorPositionAndEnqueueMilestone — per-frame handler for an actor in its state 3. Reloads the record's frame delay,
 * and every fourth frame flips the display tile between its two frames. It then advances the
 * record's 16-bit position (a low/high byte pair) by a fixed step, propagating the carry and
 * adding one extra into the high byte. When the new high byte lands on either of two milestones
 * it enqueues the matching display command and returns; below the advance threshold it just
 * returns; otherwise it steps the record on to its next dispatch state.
 *
 * LIVE-OUT: none (memory only — the record fields plus any enqueued display command). A dispatch
 * handler whose shared epilogue reads the record, not a register left behind here.
 */

const FRAME_DELAY = 0x03; //        per-frame delay reload (rec+0x11)
const TILE_A = 0x15; //             the two display tiles the flip toggles between (rec+0x0f)
const TILE_B = 0x1e;
const POS_STEP_LOW = 0x80; //       increment added to the position low byte (rec+0x05)
const MILESTONE_A = 0x52; //        high-byte values that fire a display command
const MILESTONE_B = 0x64;
const ADVANCE_LIMIT = 0xac; //      below this high byte the state does not advance
const DISPLAY_CMD_A = (0x06 << 8) | 0x94; // command words enqueued at the two milestones
const DISPLAY_CMD_B = (0x06 << 8) | 0x95;

export function advanceActorPositionAndEnqueueMilestone(m, rec = m.regs.ix) {
  const { mem8 } = m;

  mem8[rec + 0x11] = FRAME_DELAY;
  mem8[rec + 0x0b] = mem8[rec + 0x0b] + 1;
  if ((mem8[rec + 0x0b] & 0x03) === 0) {
    mem8[rec + 0x0f] = mem8[rec + 0x0f] === TILE_A ? TILE_B : TILE_A;
  }

  const low = mem8[rec + 0x05] + POS_STEP_LOW;
  mem8[rec + 0x05] = low; // store truncates to the byte
  const carry = low > 0xff ? 1 : 0;
  const high = u8(mem8[rec + 0x06] + carry + 1);
  mem8[rec + 0x06] = high;

  if (high === MILESTONE_A) { enqueueDisplayCommand(m, DISPLAY_CMD_A); return; }
  if (high === MILESTONE_B) { enqueueDisplayCommand(m, DISPLAY_CMD_B); return; }
  if (high < ADVANCE_LIMIT) return;
  mem8[rec + 0x02] = mem8[rec + 0x02] + 1;
}
