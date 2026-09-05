![Space Invaders](invaders.jpg)

>>> deploy:<br>
>>>   +invaders.jpg<br>
>>>   Hardware.md<br>
>>>   RAMUse.md<br>
>>>   %Code.md<br>

# Space Invaders

**Disassembled by Karl Stiefvater**

**Space Invaders** (Taito / Midway, 1978) is a fixed shooter. You move a **laser cannon**
left and right along the bottom of the screen and fire straight up at a descending
formation of **fifty-five aliens** — five rows of eleven. The fleet marches sideways in
lockstep; when its edge touches the wall it drops one row and reverses, so it grinds ever
closer, and every alien you destroy makes the survivors **march faster** — the famous
accelerating heartbeat. The aliens drop **bombs** as they come; four **shield bunkers**
sit between you and them, eroding a little with every hit from either side. A **saucer**
crosses the top now and then for a bonus, and clearing the whole fleet starts the next,
harder round with the formation seated one step lower. You have a small stock of reserve
cannons; you lose the game when the last one is shot, or when the fleet reaches the ground.
One or two players take turns.

## Navigation

  * [Hardware](Hardware.md) — CPU, memory map, I/O ports, the MB14241 bit-shifter, sound, framebuffer
  * [Work RAM](RAMUse.md) — the named work-RAM cells (0x2000–0x23FF)
  * [Main CPU code](Code.md) — the annotated 8080 disassembly

## About this disassembly

This disassembly, RAM map, and game description were **produced by AI** and are **verified
against the original ROM and against MAME**. The recovered code was checked to reproduce the
ROM's own execution frame-for-frame, and the game model was confirmed by observing the real
game running under MAME. It is offered here transparently, as AI work, precisely because it
is machine-checked rather than hand-asserted — so verify it against that evidence. Project:
[https://github.com/qarl/arcade-js](https://github.com/qarl/arcade-js).

Execution enters the main CPU at three points — the **reset vector** (`0x0000`), and two
per-frame interrupts, a **mid-screen** RST (`0x0008`) and a **vblank** RST (`0x0010`). The
main loop is a task scheduler that waits on a frame counter the vblank interrupt decrements,
so all the timing hangs off those two interrupts rather than off any cycle count.
