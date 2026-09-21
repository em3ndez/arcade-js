// SPDX-License-Identifier: GPL-3.0-only
/** presentChecksumForTamperTest — walk an address forward twice, by a wide step and then a narrow one, and hand back a
 * byte unrelated to either: the count the caller was already carrying, moved into the place a
 * result is read from. No memory is read or written, so the walked address is only an address.
 * LIVE-OUT: the walked address, and the byte handed back. */

import { u16 } from "../../../core/int.js";
import { offsetAddress } from "./offsetAddress.js";

export function presentChecksumForTamperTest(m, hl = m.regs.hl, de = m.regs.de, b = m.regs.b) {
  offsetAddress(m, u16(hl + de));
  return (m.regs.a = b);
}
