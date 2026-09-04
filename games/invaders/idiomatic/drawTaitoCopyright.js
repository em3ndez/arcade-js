// SPDX-License-Identifier: GPL-3.0-only
import { drawSpriteList } from "./drawSpriteList.js";
import { INPUT_CODE_STAGE_FLAG, TAITO_COPYRIGHT_TEXT, TAITO_COPYRIGHT_SCREEN_ADDR } from "./names.js";

/**
 * drawTaitoCopyright -- paint the Taito copyright line, but only from behind a two-step port-1 input code.
 *
 * WHAT IT IS
 *   Unlike the fixed status furniture, the copyright line is hidden: it surfaces only after a specific
 *   two-stage combination is present on input port 1. The first stage latches once seen, so afterward only
 *   the second code gates each subsequent draw.
 *
 * ROLE IN THE MACHINE
 *   Reached through updateFleetAndDrawCopyright (ROM 0x0bf1), the pre-round redraw trampoline. Keys off the
 *   one-shot latch INPUT_CODE_STAGE_FLAG (0x201e): while it is clear, it reads port 1, masks bits 0x76, and
 *   demands exactly 0x72 -- a mismatch returns without drawing, a match bumps the latch to 1. Armed, it
 *   re-reads port 1, masks the same 0x76, and demands 0x34; only then does it tail into drawSpriteList to
 *   lay down the nine glyphs of TAITO_COPYRIGHT_TEXT (0x0bf7) at TAITO_COPYRIGHT_SCREEN_ADDR (0x2e1b).
 *
 * ROM 0x199a-0x19bd.  Grounding: [seen].
 *
 * LIVE-OUT: on the draw path HL is advanced past the drawn line (drawSpriteList); both gate-fail paths
 * return with no draw. Callers ignore the result.
 */
export function drawTaitoCopyright(m) {
  // Stage 1 -- only while the latch is still clear (once satisfied it stays latched across frames).
  if (m.mem8[INPUT_CODE_STAGE_FLAG] === 0) {
    // Demand the first code 0x72 on the masked (0x76) port-1 bits; bail on any mismatch.
    if ((m.io.portIn(0x01) & 0x76) !== 0x72) return;
    // First code seen -> latch stage 1 so later frames skip straight to stage 2.
    m.mem8[INPUT_CODE_STAGE_FLAG] = 1;
  }
  // Stage 2 -- rechecked every call: demand the second code 0x34; bail until it is present.
  if ((m.io.portIn(0x01) & 0x76) !== 0x34) return;
  // Both codes satisfied -> draw the nine-glyph copyright line.
  return drawSpriteList(m, TAITO_COPYRIGHT_TEXT, 0x09, TAITO_COPYRIGHT_SCREEN_ADDR);
}
