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

export { mainLoop } from "./mainLoop_02bd.js";
export { sub_0008 } from "./sub_0008.js";
export { sub_0347 } from "./sub_0347.js";
export { sub_0315 } from "./sub_0315.js";
export { sub_0350 } from "./sub_0350.js";
export { entry_06b8 } from "./entry_06b8.js";
export { dispatchTask } from "./dispatchTask.js";
export { entry_062a } from "./entry_062a.js";
export { loc_066a } from "./loc_066a.js";
export { loc_0689 } from "./loc_0689.js";
export { loc_0691 } from "./loc_0691.js";
export { loc_06a8 } from "./loc_06a8.js";
export { entry_051c } from "./entry_051c.js";
export { loc_059b } from "./loc_059b.js";
export { handler_05c6 } from "./handler_05c6.js";
export { tail_05da } from "./tail_05da.js";
export { sub_055f } from "./sub_055f.js";
export { draw_056b } from "./draw_056b.js";
export { draw_0578 } from "./draw_0578.js";
export { loop_0583 } from "./loop_0583.js";
export { sub_0593 } from "./sub_0593.js";
export { handler_05e9 } from "./handler_05e9.js";
export { sub_037f } from "./sub_037f.js";
export { sub_0010 } from "./sub_0010.js";
export { sub_0030 } from "./sub_0030.js";
export { sub_03a2 } from "./sub_03a2.js";
export { sub_03f2 } from "./sub_03f2.js";
export { entry_0611 } from "./entry_0611.js";
export { sub_0616 } from "./sub_0616.js";
