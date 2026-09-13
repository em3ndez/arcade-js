// SPDX-License-Identifier: GPL-3.0-only
import { loc_1 } from "./names.js";
import { loc_b230 } from "./loc_b230.js";
import { loc_d804 } from "./loc_d804.js";
import { loc_b8ba } from "./loc_b8ba.js";
import { loc_adea } from "./loc_adea.js";
import { loc_af81 } from "./loc_af81.js";
import { loc_ae1c } from "./loc_ae1c.js";
import { loc_aa62 } from "./loc_aa62.js";
import { loc_aa5a } from "./loc_aa5a.js";
import { loc_aa6f } from "./loc_aa6f.js";
import { loc_b102 } from "./loc_b102.js";
import { loc_b131 } from "./loc_b131.js";
import { loc_aa79 } from "./loc_aa79.js";

// Computed-jump dispatcher (an RTS trampoline in the original): the pre-doubled selector picks one of
// twelve targets from a word table and runs it. Dissolved here into a direct table select.
const TABLE = [
  loc_b230, loc_d804, loc_b8ba, loc_adea, loc_af81, loc_ae1c,
  loc_aa62, loc_aa5a, loc_aa6f, loc_b102, loc_b131, loc_aa79,
];

export function loc_b20d(m) {
  return TABLE[m.mem8[loc_1] >> 1](m);
}
