// SPDX-License-Identifier: GPL-3.0-only
import { loc_4103 } from "./loc_4103.js";
import { descendObjectToLanding } from "./descendObjectToLanding.js";
import { loc_416f } from "./loc_416f.js";
import { loc_4179 } from "./loc_4179.js";
import { loc_417a } from "./loc_417a.js";
import { loc_418d } from "./loc_418d.js";
import { moveFormationAndSpawnObject } from "./moveFormationAndSpawnObject.js";
import { loc_4350 } from "./loc_4350.js";
import { loc_4364 } from "./loc_4364.js";
import { loc_4378 } from "./loc_4378.js";
/**
 * loc_40d0 — IX-object state dispatcher. Skips an inactive record (bit0 of (IX+0)|(IX+1) clear) and an
 * out-of-range state ((IX+2)&0x1f >= 0x11). Otherwise tail-hands the state to one of 17 handlers; each
 * returns straight to our caller (no continuation stacked). LIVE-OUT: memory only.
 */
export function loc_40d0(m, rec = m.regs.ix) {
  const { mem8 } = m;
  if (((mem8[rec + 0x00] | mem8[rec + 0x01]) & 1) === 0) return; // inactive record
  const state = mem8[rec + 0x02] & 0x1f;
  if (state >= 0x11) return; // state index out of range (cp 0x11 -> ret nc)
  switch (state) {
    case 0: return loc_4103(m, rec);
    case 1: return descendObjectToLanding(m, rec);
    case 2: return loc_416f(m, rec);
    case 3: case 4: case 5: case 6: case 7: return loc_4179(m);
    case 8: return loc_417a(m, rec);
    case 9: return loc_418d(m, rec);
    case 10: return loc_4179(m);
    case 11: return moveFormationAndSpawnObject(m, rec);
    case 12: return loc_4350(m, rec);
    case 13: return loc_4364(m, rec);
    case 14: case 15: case 16: return loc_4378(m);
  }
}
