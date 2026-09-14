// SPDX-License-Identifier: GPL-3.0-only
import { requestEaromBlankWrite } from "./requestEaromBlankWrite.js";

/**
 * eraseEaromLowRegions — request a blanked EAROM write of the two low regions. ROM 0xdded.
 *
 * Role in the machine: the EAROM is Tempest's non-volatile store (high-score table and bookkeeping).
 * When the machine needs to clear its lowest two saved regions, this branch-only trampoline is the
 * entry point the higher-level code jumps to, so the clear reads as a single named action.
 *
 * Behavior: it does nothing itself but hand off to requestEaromBlankWrite (ddf3) with the region
 * mask 0x03 — the two low bits selecting the two low regions — which stages the actual blank write.
 *
 * Live-out: whatever requestEaromBlankWrite stages; downstream the EAROM shadow cells loc_1c7/loc_1c8
 * were observed changing as the queued write drains. Grounding: [code].
 */
// Trampoline: run the mask-merge with the 0x03 mask.
export function eraseEaromLowRegions(m) {
  requestEaromBlankWrite(m, 0x03); // mask 0x03 selects the two low EAROM regions
}
