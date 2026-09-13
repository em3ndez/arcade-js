// SPDX-License-Identifier: GPL-3.0-only
import { DSW1_COINAGE, DSW2_OPTIONS } from "./names.js";
import { loc_df53 } from "./loc_df53.js";
import { loc_df6a } from "./loc_df6a.js";
import { loc_dd29 } from "./loc_dd29.js";
import { loc_dd27 } from "./loc_dd27.js";
import { loc_dbe0 } from "./loc_dbe0.js";

// Build the vector list for the spinner/knob readout: emit a fixed header word and a
// zero-tagged word, then two eight-digit runs keyed by the DIP-switch ports DSW1_COINAGE and
// DSW2_OPTIONS. The exit A of the DSW2_OPTIONS run drives the POKEY pot-scan pulse, which returns the
// assembled pot-status byte; that byte (carried through Y) keys the final eight-digit
// run. The final run's exit A propagates out.
export function loc_dd0d(m) {
  const { mem8 } = m;
  loc_df53(m);
  loc_df6a(m, 0x00);
  loc_dd29(m, mem8[DSW1_COINAGE], 0xe8);
  const a = loc_dd27(m, mem8[DSW2_OPTIONS]);
  const r = loc_dbe0(m, a);
  return loc_dd27(m, r);
}
