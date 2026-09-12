// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_df6a } from "./loc_df6a.js";
import { loc_b0d1 } from "./loc_b0d1.js";
import { loc_ab14 } from "./loc_ab14.js";
import { loc_ab0d } from "./loc_ab0d.js";
import { loc_aaa8 } from "./loc_aaa8.js";
import { loc_a97f } from "./loc_a97f.js";
import { loc_a9d7 } from "./loc_a9d7.js";
import { loc_df39 } from "./loc_df39.js";
import { loc_b0c6 } from "./loc_b0c6.js";
import {
  loc_72, loc_5, loc_3, loc_6, loc_a2, loc_31e4, loc_2fa6, loc_2fa8,
  loc_3e, loc_43, loc_44, loc_45, loc_0, loc_3b, loc_3c, loc_cde4, loc_cde5,
  loc_16c, loc_aace, loc_38, loc_61b, loc_31fa, loc_2f60, loc_123, loc_3d, loc_102,
} from "./names.js";

// Per-frame overlay build: mirror one control byte, refresh the header, and when the
// mode byte is live pick a marker slot, draw it, and duplicate a snapshot into two mirror
// cells. Always emit the base list; when the flag word is set emit a second. Off the
// safe mode it rebuilds a checksum plus a 3-entry mirror table. Finally emit the framing
// word and, in the active phase, draw the indexed slot pair and two trailing markers.
export function loc_a8b4(m) {
  const { mem8 } = m;
  mem8[loc_72] = 0x01;
  loc_df6a(m, 0x01);
  loc_b0d1(m, 0x05);

  if (!(mem8[loc_5] & 0x80)) {
    let idx;
    if (mem8[loc_3] & 0x20) idx = 0x00;
    else if (mem8[loc_6] === 0) idx = 0x22;
    else if (mem8[loc_a2] & 0x80) idx = 0x22;
    else idx = 0x06;
    loc_ab14(m, idx);
    loc_ab0d(m);
    const snap = mem8[loc_31e4];
    mem8[loc_2fa6] = snap;
    mem8[loc_2fa8] = snap;
    loc_aaa8(m);
  }

  loc_a97f(m, 0x01, 0x00);

  // A second list follows only when the flag source is nonzero.
  const flag = (mem8[loc_5] & 0x80)
    ? mem8[loc_3e]
    : mem8[loc_43] | mem8[loc_44] | mem8[loc_45];
  if (flag !== 0) loc_a97f(m, 0x01, 0x01);

  if (mem8[loc_0] !== 0x04) {
    mem8[loc_3b] = 0x1d;
    mem8[loc_3c] = 0x07;
    loc_a9d7(m, mem8[loc_cde4]);
    // Fold a fixed table into one checksum byte.
    let cksum = 0xa7;
    for (let y = 0x0a; y >= 0; y--) cksum ^= mem8[u16(loc_aace + y)];
    mem8[loc_16c] = cksum;
    // Copy three source entries (doubled index) into a strided mirror.
    let dst = mem8[loc_cde5];
    for (let c = 2; c >= 0; c--) {
      const y = (mem8[u16(loc_61b + c)] << 1) & 0xff;
      mem8[u16(loc_2f60 + dst)] = mem8[u16(loc_31fa + y)];
      dst = (dst + 2) & 0xff;
    }
    mem8[loc_38] = 0xff;
  }

  loc_df39(m, 0x2f, 0x60);

  if (mem8[loc_123] & 0x80) loc_ab14(m, 0x36);

  if (mem8[loc_0] !== 0x18) return;
  if (!(mem8[loc_5] & 0x80)) return;

  if (mem8[u16(loc_102 + mem8[loc_3d])] !== 0) {
    loc_ab14(m, 0x30);
    loc_b0c6(m, mem8[u16(loc_102 + mem8[loc_3d])]);
  }
  loc_ab14(m, 0x3a);
  loc_ab14(m, 0x38);
}
