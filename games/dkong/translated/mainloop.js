// SPDX-License-Identifier: GPL-3.0-only
/**
 * Translated main loop and the routines the first iterations reach.
 *
 * Continues in EXECUTION ORDER from where boot.js leaves off. Boot falls
 * through from 0x02BC straight into 0x02BD.
 *
 * THE MAIN LOOP IS A TASK SCHEDULER, and it SYNCHRONISES TO THE NMI. It spins
 * comparing the frame counter at 0x601A against its last-seen copy at 0x6383
 * (`jr z,0x02bd`), doing nothing until the vblank NMI changes it. So the loop
 * is not free-running: without the NMI translated it spins forever, and
 * 0x6019 -- which it increments every pass -- runs away. That is the natural
 * cooperative boundary between the two, and it is why the NMI handler is the
 * next required piece rather than an optional one.
 *
 * Every routine carries its ROM range and original mnemonics.
 */

export { loc_02bd } from "./loc_02bd.js";
export { loc_0008 } from "./loc_0008.js";
export { loc_0347 } from "./loc_0347.js";
export { loc_0315 } from "./loc_0315.js";
export { loc_0350 } from "./loc_0350.js";
export { loc_06b8 } from "./loc_06b8.js";
export { loc_02e3 } from "./loc_02e3.js";
export { loc_062a } from "./loc_062a.js";
export { loc_066a } from "./loc_066a.js";
export { loc_0689 } from "./loc_0689.js";
export { loc_0691 } from "./loc_0691.js";
export { loc_06a8 } from "./loc_06a8.js";
export { loc_051c } from "./loc_051c.js";
export { loc_059b } from "./loc_059b.js";
export { loc_05c6 } from "./loc_05c6.js";
export { loc_05da } from "./loc_05da.js";
export { loc_055f } from "./loc_055f.js";
export { loc_056b } from "./loc_056b.js";
export { loc_0578 } from "./loc_0578.js";
export { loc_0583 } from "./loc_0583.js";
export { loc_0593 } from "./loc_0593.js";
export { loc_05e9 } from "./loc_05e9.js";
export { loc_037f } from "./loc_037f.js";
export { loc_0010 } from "./loc_0010.js";
export { loc_0030 } from "./loc_0030.js";
export { loc_03a2 } from "./loc_03a2.js";
export { loc_03f2 } from "./loc_03f2.js";
export { loc_0611 } from "./loc_0611.js";
export { loc_0616 } from "./loc_0616.js";
