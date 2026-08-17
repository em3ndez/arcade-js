// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchFrogAnimationArm — the frog-animation jump-table dispatcher. The low byte of the anim-index
 * cell selects one of eleven arm pointers in a jump table; this routine reads that pointer and jumps
 * into the matching arm. Each arm sets up its sprite and plot state and hands off through the shared
 * render loop, which drains back to the caller with one net return. LIVE-OUT: memory-only.
 */
import { NotImplemented } from "../../../boards/frogger/io.js";
import { loc_8000 } from "./names.js";
import { renderFrogAnimArm0 } from "./renderFrogAnimArm0.js";
import { renderFrogAnimArm1 } from "./renderFrogAnimArm1.js";
import { renderFrogAnimArm2 } from "./renderFrogAnimArm2.js";
import { renderFrogAnimArm3 } from "./renderFrogAnimArm3.js";
import { renderFrogAnimArm4 } from "./renderFrogAnimArm4.js";
import { renderFrogAnimArm6 } from "./renderFrogAnimArm6.js";
import { renderFrogAnimArm7 } from "./renderFrogAnimArm7.js";
import { renderFrogAnimArm8 } from "./renderFrogAnimArm8.js";
import { renderFrogAnimArm9 } from "./renderFrogAnimArm9.js";
import { renderFrogAnimArm10 } from "./renderFrogAnimArm10.js";

const ARM_TABLE = 0x0fbe; // base of the eleven arm entry pointers

export function dispatchFrogAnimationArm(m) {
  const index = m.mem8[loc_8000]; // anim index 0..10
  const target = m.mem16[(ARM_TABLE + 2 * index)];

  switch (target) {
    case 0x0fd4: return renderFrogAnimArm0(m);
    case 0x1058: return renderFrogAnimArm1(m);
    case 0x107b: return renderFrogAnimArm2(m);
    case 0x109b: return renderFrogAnimArm3(m);
    case 0x10bb: return renderFrogAnimArm4(m);
    case 0x10db: return m.call(0x10db);
    case 0x10f8: return renderFrogAnimArm6(m);
    case 0x1118: return renderFrogAnimArm7(m);
    case 0x1138: return renderFrogAnimArm8(m);
    case 0x1158: return renderFrogAnimArm9(m);
    case 0x1178: return renderFrogAnimArm10(m);
    default:
      throw new NotImplemented(
        `dispatchFrogAnimationArm: target 0x${target.toString(16)} outside the arm table ` +
          "{0x0fd4..0x1178} -- anim index > 10",
      );
  }
}
