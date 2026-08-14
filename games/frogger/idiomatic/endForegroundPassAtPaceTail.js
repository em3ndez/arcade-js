// SPDX-License-Identifier: GPL-3.0-only

// endForegroundPassAtPaceTail - the pace tail as a coroutine. The in-play tree tail-calls it and hands
// this generator back UNRUN (touching no Z80 stack, like a jump), so control returns to the driver,
// which discards it and yields.
export function* endForegroundPassAtPaceTail() {}
