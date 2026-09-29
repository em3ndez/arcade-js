// SPDX-License-Identifier: GPL-3.0-only
/** runCommandRingDrainLoop — the foreground loop: take commands off the 64-cell ring, one at a time, for ever.
 *  A read cursor names a cell; high bit set means empty, so the loop looks again — it has no exit
 *  of its own. An occupied cell gives up a command and an argument byte, BOTH freed before the
 *  command runs so it may reuse the pair. The low nibble picks one of sixteen handlers out of a
 *  table fixed in the program image; each case below is the handler its slot names, handed the
 *  argument byte, and when it finishes the loop looks again. A GENERATOR, yielding where the ring
 *  is empty — the only vblank wait among the foreground loops a coin-and-play tape reaches. A
 *  handler that restarts the machine hands back the new foreground, and the loop gives way to it
 *  for good. LIVE-OUT: memory, and whatever the command left behind. */

import { u16, u8 } from "../../../core/int.js";
import { NotImplemented } from "../../../boards/timeplt/io.js";
import { replayCloudBands } from "./replayCloudBands.js";
import { drawTextRunByIndex } from "./drawTextRunByIndex.js";
import { drawCaptionInPenColour } from "./drawCaptionInPenColour.js";
import { eraseTextRunByIndex } from "./eraseTextRunByIndex.js";
import { awardScoreToPlayer } from "./awardScoreToPlayer.js";
import { drawEmblemStripThenGuardImage } from "./drawEmblemStripThenGuardImage.js";
import { drawCountAsPictogramStrip } from "./drawCountAsPictogramStrip.js";
import { drawRoundNumberCaption } from "./drawRoundNumberCaption.js";
import { drawCaptionFivePastSharedColour } from "./drawCaptionFivePastSharedColour.js";
import { drawCaptionTenPastSharedColour } from "./drawCaptionTenPastSharedColour.js";
import { COMMAND_READ_CURSOR, COMMAND_RING } from "./names.js";

const RING_CELLS = 64;
const FREE = 255;
const OCCUPIED_BIT = 0x80;
const HANDLER_BITS = 0x0f;

/** Run the handler the command's low nibble selects, handing it the argument byte. */
function runCommand(m, slot, argument) {
  switch (slot) {
    case 1: return drawTextRunByIndex(m, argument);
    case 2: return drawCaptionInPenColour(m, argument);
    case 3: return eraseTextRunByIndex(m, argument);
    case 4: return awardScoreToPlayer(m, argument);
    case 5: return drawEmblemStripThenGuardImage(m, argument);
    case 6: return drawCountAsPictogramStrip(m, argument);
    case 7: return drawRoundNumberCaption(m);
    case 10: return drawCaptionFivePastSharedColour(m, argument);
    case 11: return drawCaptionTenPastSharedColour(m, argument);
    // Seven slots have no case. Slot 0's handler is not written here; slots 8, 9 and 12-15 would only
    // return at once, and they raise too, so every slot without a case fails the same way.
    default:
      throw new NotImplemented(`runCommandRingDrainLoop: command slot ${slot} names no transcribed handler`);
  }
}

const isCoroutine = (r) => r !== null && typeof r === "object" && typeof r.next === "function";

export function* runCommandRingDrainLoop(m) {
  const { mem8 } = m;
  for (;;) {
    const commandCell = u16(COMMAND_RING + mem8[COMMAND_READ_CURSOR]);
    if (mem8[commandCell] & OCCUPIED_BIT) { // high bit SET means EMPTY; the name reads backwards
      replayCloudBands(m); // beam-sync render: repaint the frame's multiplexed clouds in bands
      yield;
      continue;
    }

    const command = mem8[commandCell];
    mem8[commandCell] = FREE;
    const argumentCell = u16(commandCell + 1);
    const argument = mem8[argumentCell];
    mem8[argumentCell] = FREE;
    mem8[COMMAND_READ_CURSOR] = u8(argumentCell + 1) & (RING_CELLS - 1);

    const after = runCommand(m, command & HANDLER_BITS, argument);
    if (isCoroutine(after)) return yield* after;
  }
}
