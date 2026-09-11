// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  loc_6, loc_7, loc_8, loc_9, loc_c, loc_d,
  loc_10, loc_13, loc_16, loc_17, loc_18, loc_cfd9,
} from "./names.js";

// Update three parallel lanes ($0d/$10/$13 indexed by lane) driven by control bits, then
// accumulate a running position/score into $16/$17/$18 through a small lookup table, and
// finally run two clamp passes over the $13 lane triple. The lane update is a dense
// branch web, so it is walked block-by-block; `carry` tracks the running carry bit.
export function loc_cf24(m) {
  const { mem8 } = m;
  let a = 0;
  let y = 0;
  let carry = 0;
  let x = 2;
  let phase = "b_cf26";

  while (true) {
    switch (phase) {
      case "b_cf26": {
        a = mem8[loc_8];
        if (x === 1) { carry = a & 1; a >>= 1; carry = a & 1; a >>= 1; }
        else if (x >= 1) { carry = a & 1; a >>= 1; }
        else { carry = a & 1; a >>= 1; carry = a & 1; a >>= 1; carry = a & 1; a >>= 1; }
        a = mem8[u8(loc_d + x)] & 0x1f;
        if (carry) { phase = "b_cf6f"; break; }
        if (a === 0) { phase = "b_cf4a"; break; }
        carry = a >= 0x1b ? 1 : 0;
        if (carry) { phase = "b_cf48"; break; }
        y = a;
        { const t = mem8[loc_7] & 0x07; carry = t >= 0x07 ? 1 : 0; }
        a = y;
        if (!carry) { phase = "b_cf4a"; break; }
        phase = "b_cf48"; break;
      }
      case "b_cf48": {
        { const s = a - 1 - (1 - carry); carry = s >= 0 ? 1 : 0; a = s & 0xff; }
        phase = "b_cf4a"; break;
      }
      case "b_cf4a": {
        mem8[u8(loc_d + x)] = a;
        a = mem8[loc_8] & 0x08;
        if (a !== 0) { phase = "b_cf57"; break; }
        a = 0xf0;
        mem8[loc_c] = a;
        phase = "b_cf57"; break;
      }
      case "b_cf57": {
        a = mem8[loc_c];
        if (a === 0) { phase = "b_cf63"; break; }
        mem8[loc_c] = u8(mem8[loc_c] - 1);
        a = 0;
        mem8[u8(loc_d + x)] = 0;
        mem8[u8(loc_10 + x)] = 0;
        phase = "b_cf63"; break;
      }
      case "b_cf63": {
        carry = 0;
        a = mem8[u8(loc_10 + x)];
        if (a === 0) { phase = "b_cf8b"; break; }
        { const v = u8(mem8[u8(loc_10 + x)] - 1); mem8[u8(loc_10 + x)] = v;
          if (v !== 0) { phase = "b_cf8b"; break; } }
        carry = 1;
        phase = "b_cf8b"; break;
      }
      case "b_cf6f": {
        carry = a >= 0x1b ? 1 : 0;
        if (carry) { phase = "b_cf7c"; break; }
        a = mem8[u8(loc_d + x)];
        { const s = a + 0x20; carry = s > 0xff ? 1 : 0; a = s & 0xff; }
        if (!carry) { phase = "b_cf4a"; break; }
        if (a === 0) { phase = "b_cf7c"; break; }
        carry = 0;
        phase = "b_cf7c"; break;
      }
      case "b_cf7c": {
        a = 0x1f;
        if (carry) { phase = "b_cf4a"; break; }
        mem8[u8(loc_d + x)] = a;
        a = mem8[u8(loc_10 + x)];
        if (a === 0) { phase = "b_cf87"; break; }
        carry = 1;
        phase = "b_cf87"; break;
      }
      case "b_cf87": {
        a = 0x78;
        mem8[u8(loc_10 + x)] = a;
        phase = "b_cf8b"; break;
      }
      case "b_cf8b": {
        if (!carry) { phase = "b_cfb7"; break; }
        a = 0;
        if (x < 1) { phase = "b_cfa9"; break; }
        if (x === 1) { phase = "b_cfa1"; break; }
        a = mem8[loc_9] & 0x0c;
        carry = a & 1; a >>= 1; carry = a & 1; a >>= 1;
        if (a === 0) { phase = "b_cfa9"; break; }
        { const s = a + 0x02 + carry; carry = s > 0xff ? 1 : 0; a = s & 0xff; }
        if (a !== 0) { phase = "b_cfa9"; break; }
        phase = "b_cfa1"; break;
      }
      case "b_cfa1": {
        a = mem8[loc_9] & 0x10;
        if (a === 0) { phase = "b_cfa9"; break; }
        a = 0x01;
        phase = "b_cfa9"; break;
      }
      case "b_cfa9": {
        const sv = a;
        { const s = sv + mem8[loc_16] + 1; carry = s > 0xff ? 1 : 0; mem8[loc_16] = s; }
        { const s = sv + mem8[loc_17] + 1; carry = s > 0xff ? 1 : 0; a = s & 0xff; mem8[loc_17] = a; }
        mem8[u8(loc_13 + x)] = u8(mem8[u8(loc_13 + x)] + 1);
        phase = "b_cfb7"; break;
      }
      case "b_cfb7": {
        x = x - 1;
        if (x < 0) { phase = "b_cfbd"; break; }
        phase = "b_cf26"; break;
      }
      case "b_cfbd": {
        a = mem8[loc_9];
        a >>= 1; a >>= 1; a >>= 1; a >>= 1; a >>= 1;
        y = a;
        a = mem8[loc_16];
        { const s = a - mem8[u16(loc_cfd9 + y)]; carry = s >= 0 ? 1 : 0; a = s & 0xff; }
        if (a & 0x80) { phase = "b_cfe1"; break; }
        mem8[loc_16] = a;
        mem8[loc_18] = u8(mem8[loc_18] + 1);
        if (y !== 0x03) { phase = "b_cfe1"; break; }
        mem8[loc_18] = u8(mem8[loc_18] + 1);
        if (mem8[loc_18] !== 0) { phase = "b_cfe1"; break; }
        throw new Error("loc_cf24: fell through into the embedded data table (state wrapped) -- unreachable in a valid state");
      }
      case "b_cfe1": {
        a = mem8[loc_9] & 0x03;
        y = a;
        if (a === 0) { phase = "b_d002"; break; }
        carry = a & 1; a >>= 1;
        { const s = a + carry; carry = s > 0xff ? 1 : 0; a = s & 0xff; }
        a = a ^ 0xff;
        { const s = a + mem8[loc_17] + 1; carry = s > 0xff ? 1 : 0; a = s & 0xff; }
        if (carry) { phase = "b_cffa"; break; }
        { const s = a + mem8[loc_18] + carry; carry = s > 0xff ? 1 : 0; a = s & 0xff; }
        if (a & 0x80) { phase = "b_d004"; break; }
        mem8[loc_18] = a;
        a = 0;
        phase = "b_cffa"; break;
      }
      case "b_cffa": {
        carry = y >= 0x02 ? 1 : 0;
        if (carry) { phase = "b_d000"; break; }
        mem8[loc_6] = u8(mem8[loc_6] + 1);
        phase = "b_d000"; break;
      }
      case "b_d000": {
        mem8[loc_6] = u8(mem8[loc_6] + 1);
        phase = "b_d002"; break;
      }
      case "b_d002": {
        mem8[loc_17] = a;
        phase = "b_d004"; break;
      }
      case "b_d004": {
        a = mem8[loc_7];
        carry = a & 1; a >>= 1;
        if (carry) { phase = "b_d030"; break; }
        y = 0; x = 2;
        phase = "b_d00d"; break;
      }
      case "b_d00d": {
        a = mem8[u8(loc_13 + x)];
        if (a === 0) { phase = "b_d01a"; break; }
        carry = a >= 0x10 ? 1 : 0;
        if (!carry) { phase = "b_d01a"; break; }
        { const s = a + 0xef + carry; carry = s > 0xff ? 1 : 0; a = s & 0xff; }
        y = u8(y + 1);
        mem8[u8(loc_13 + x)] = a;
        phase = "b_d01a"; break;
      }
      case "b_d01a": {
        x = x - 1;
        if (x >= 0) { phase = "b_d00d"; break; }
        a = y;
        if (a !== 0) { phase = "b_d030"; break; }
        x = 2;
        phase = "b_d022"; break;
      }
      case "b_d022": {
        a = mem8[u8(loc_13 + x)];
        if (a === 0) { phase = "b_d02d"; break; }
        carry = 0;
        { const s = a + 0xef + carry; carry = s > 0xff ? 1 : 0; a = s & 0xff; }
        mem8[u8(loc_13 + x)] = a;
        if (a & 0x80) { phase = "b_d030"; break; }
        phase = "b_d02d"; break;
      }
      case "b_d02d": {
        x = x - 1;
        if (x >= 0) { phase = "b_d022"; break; }
        phase = "b_d030"; break;
      }
      case "b_d030":
        return;
    }
  }
}
