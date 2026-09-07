// SPDX-License-Identifier: GPL-3.0-only
/**
 * armInputFlagAndDrawInputColumns -- fold the input ports, raise the start flag, then draw the attract UI.
 *
 * WHAT IT IS
 *   A short link in the attract-mode input scan. It folds the two input-port bytes it is handed, raises a
 *   companion flag when the shared bit-4 input is set, and then tail-delegates to the routine that paints
 *   the dip-switch readout columns and seeds the screen-fill animation. It is where the raw button read
 *   raises a companion input flag plus the attract-screen redraw.
 *
 * ROLE IN THE MACHINE
 *   Reached during attract (mechanisms.md "The attract input readout and the screen fill"), including as
 *   the fall-through target of requestSound6AndContinueInputScan (0x1c5d). The two input bytes arrive in
 *   B and C (IN0/IN1 reads). Bit 4 (the START_BIT local is a pre-existing misnomer -- the game-start buttons
 *   are IN1 bits 0/1, handled by beginGameOnStartButton) is a shared input bit also tested by
 *   armBehaviorGateOnInputOrTimer; set in either folded byte it raises the companion input flag loc_41cc
 *   (whose exact role is a [guess]). It then falls through into drawInputTextColumnsAndSeedScreenFill,
 *   which decodes the dip-switch fields into text columns and (unless suppressed) seeds the screen fill.
 *
 * ROM 0x1c68.  Grounding: [seen].
 *
 * LIVE-OUT: memory only -- loc_41cc when the start bit is set, plus everything the delegated init writes.
 * Returns that delegate's result.
 */
import { loc_41cc } from "./names.js";
import { drawInputTextColumnsAndSeedScreenFill } from "./drawInputTextColumnsAndSeedScreenFill.js";

// The start button is bit 4 of the input ports; folding IN0|IN1 lets either port's copy trigger it.
const START_BIT = 0x10; // bit 4 of the folded input ports

export function armInputFlagAndDrawInputColumns(m, in0 = m.regs.b, in1 = m.regs.c) {
  const { mem8 } = m;

  // Fold the two port bytes and test the shared bit-4 input; if set, raise the companion flag loc_41cc
  // so the rest of the machine sees the start request. Then hand off to the attract-column / screen-fill
  // init as a tail call (this routine's whole tail is that delegate's body).
  if ((in0 | in1) & START_BIT) mem8[loc_41cc] = 1;
  return drawInputTextColumnsAndSeedScreenFill(m);
}
