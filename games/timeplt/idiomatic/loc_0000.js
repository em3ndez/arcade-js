// SPDX-License-Identifier: GPL-3.0-only
/** loc_0000 — where the processor starts from cold: three bytes that hand straight on to the
 * power-on routine, touching nothing on the way. LIVE-OUT: whatever that routine leaves. */

import { seatTheStackAndSettleTheControlLatch } from "./seatTheStackAndSettleTheControlLatch.js";

export function loc_0000(m) {
  return seatTheStackAndSettleTheControlLatch(m);
}
