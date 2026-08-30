// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  FORMATION_SLOT_TABLE,
  DISPLAY_LIST_DST_PTR,
  DISPLAY_LIST_SRC_PTR,
  DISPLAY_LIST_DST_PTR_ALT,
  DISPLAY_LIST_SRC_PTR_ALT,
  SUBPHASE_TICK,
} from "./names.js";
/**
 * paintDisplayListRunToVram — the display-list interpreter: walk a compact layout stream and
 * paint it into video RAM.
 *
 * ROM 0x4381. Grounding: [seen].
 *
 * Pooyan describes big blocks of the screen not as raw tile data but as a small bytecode "display
 * list" held in ROM (the stream table lives at 0x43e1-0x4a0a). This routine is the interpreter
 * for that bytecode: it reads a source pointer into the stream and a destination pointer into
 * video RAM, then processes up to a fixed budget of source bytes, emitting or repositioning as
 * it goes. Because the source data drives the destination, one call paints an irregular run of
 * cells cheaply — literal bytes for the parts that change, skip opcodes to jump over the parts
 * that do not.
 *
 * Two pointer pairs exist and one is chosen per call by FORMATION_SLOT_TABLE (0x8920), the
 * display sub-phase selector: when it is zero the primary pair is used
 * (DISPLAY_LIST_DST_PTR / DISPLAY_LIST_SRC_PTR, 0x8f43 / 0x8f45); when nonzero the alternate
 * pair is used (DISPLAY_LIST_DST_PTR_ALT / DISPLAY_LIST_SRC_PTR_ALT, 0x88b8 / 0x88ba). Both
 * pairs hold a live video-RAM destination and a live stream source, and both are ADVANCED as
 * the copy runs so the next call resumes where this one stopped.
 *
 * The bytecode has three cases:
 *   - a literal byte is copied straight to the destination; both pointers step forward one and
 *     the byte budget shrinks by one;
 *   - the skip opcode 0x10 takes the following byte as a distance, advances the destination by
 *     that distance (painting nothing) and shrinks the remaining budget by the same amount —
 *     this is how the stream jumps a gap in the layout;
 *   - the reload opcode 0xff loads a brand-new destination pointer from the next two stream
 *     bytes, folds the byte after that into the sub-phase tick counter SUBPHASE_TICK (0x88b7),
 *     and ends the run.
 *
 * A subtlety in the tail: on any exit OTHER than a reload, the ROM nudges the destination
 * pointer forward by three before storing it — the resume position for the next call sits three
 * cells past the last write. A reload skips that nudge because it has already installed a fresh
 * destination from the stream. On exit the (advanced) pointer pair is written back to whichever
 * pair was selected on entry.
 *
 * LIVE-OUT: memory only — the copied video-RAM cells, the written-back destination/source
 * pointer pair, and the updated SUBPHASE_TICK. Calls nothing.
 */

const MAX_BYTES = 0x1d; // ceiling on bytes processed per call (the byte budget)
const CMD_SKIP = 0x10; // opcode: advance the destination by the next byte, shrink the budget
const CMD_RELOAD = 0xff; // opcode: install a fresh destination pointer + bump the sub-phase tick

export function paintDisplayListRunToVram(m) {
  const { mem8 } = m;

  // Pick the pointer pair for this call. FORMATION_SLOT_TABLE (0x8920) is the display sub-phase
  // selector: zero -> the primary pair, nonzero -> the alternate pair. The same selector is
  // re-read at store time so the writeback lands on the pair chosen here.
  const useAlt = mem8[FORMATION_SLOT_TABLE] !== 0;
  const dstPtr = useAlt ? DISPLAY_LIST_DST_PTR_ALT : DISPLAY_LIST_DST_PTR;
  const srcPtr = useAlt ? DISPLAY_LIST_SRC_PTR_ALT : DISPLAY_LIST_SRC_PTR;

  // Load the live destination (into video RAM) and source (into the ROM stream) pointers, each
  // stored little-endian, and start the byte budget at its ceiling.
  let dst = mem8[dstPtr] | (mem8[dstPtr + 1] << 8);
  let src = mem8[srcPtr] | (mem8[srcPtr + 1] << 8);
  let remaining = MAX_BYTES;
  let advanceDstThree = true; // the tail step, skipped only by a reload opcode

  while (remaining > 0) {
    const cmd = mem8[src];

    // Skip opcode: the next stream byte is a distance. Move the destination that far without
    // painting, step the source past both bytes, and charge the distance against the budget.
    // A budget that reaches zero here ends the run.
    if (cmd === CMD_SKIP) {
      const skip = mem8[u16(src + 1)];
      dst = u16(dst + skip);
      src = u16(src + 2);
      remaining = (remaining - skip) & 0xff;
      if (remaining === 0) break;
      continue;
    }

    // Reload opcode: pull a fresh little-endian destination pointer from the next two stream
    // bytes, add the byte after that into SUBPHASE_TICK (0x88b7), and end the run. The tail
    // three-cell nudge is suppressed because a new destination has just been installed.
    if (cmd === CMD_RELOAD) {
      dst = mem8[u16(src + 1)] | (mem8[u16(src + 2)] << 8);
      mem8[SUBPHASE_TICK] = mem8[SUBPHASE_TICK] + mem8[u16(src + 3)];
      src = u16(src + 4);
      advanceDstThree = false;
      break;
    }

    // Literal byte: copy it straight into video RAM, step both pointers forward one, and spend
    // one unit of the budget.
    mem8[dst] = cmd;
    src = u16(src + 1);
    dst = u16(dst + 1);
    remaining -= 1;
  }

  // On any non-reload exit the destination resumes three cells past the last write.
  if (advanceDstThree) dst = u16(dst + 3);

  // Write the advanced destination and source back to the pair selected on entry (little-endian)
  // so the next call continues the stream from here.
  mem8[dstPtr] = dst;
  mem8[dstPtr + 1] = dst >> 8;
  mem8[srcPtr] = src;
  mem8[srcPtr + 1] = src >> 8;
}
