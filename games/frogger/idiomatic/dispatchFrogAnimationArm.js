// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchFrogAnimationArm — the frog-animation dispatcher. The anim-index cell (0..10) selects one of
 * eleven arms; the ROM jump table it indexes is fixed, so we dispatch on the index directly. Each arm
 * sets up its sprite and plot state and hands off through the shared render loop, which drains back to
 * the caller with one net return. LIVE-OUT: memory-only.
 */
import { NotImplemented } from "../../../boards/frogger/io.js";
import { loc_8000 } from "./names.js";
import { advanceFrogAnimIndexAndRedispatch } from "./advanceFrogAnimIndexAndRedispatch.js";
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


export function dispatchFrogAnimationArm(m) {
  const index = m.mem8[loc_8000]; // anim index 0..10

  switch (index) {
    case 0: return renderFrogAnimArm0(m);
    case 1: return renderFrogAnimArm1(m);
    case 2: return renderFrogAnimArm2(m);
    case 3: return renderFrogAnimArm3(m);
    case 4: return renderFrogAnimArm4(m);
    case 5: return advanceFrogAnimIndexAndRedispatch(m); // arm 5 renders nothing -- straight to the index advance
    case 6: return renderFrogAnimArm6(m);
    case 7: return renderFrogAnimArm7(m);
    case 8: return renderFrogAnimArm8(m);
    case 9: return renderFrogAnimArm9(m);
    case 10: return renderFrogAnimArm10(m);
    default:
      throw new NotImplemented(`dispatchFrogAnimationArm: anim index ${index} outside 0..10`);
  }
}
