-- SPDX-License-Identifier: GPL-3.0-only
-- Space Invaders (8080): trace device writes. Unlike the Konami boards these are 8080 OUT PORT writes
-- (shift count/data @2/@4, sound @3/@5, watchdog @6) on the I/O space, NOT memory-mapped. ★ MINIMAL
-- until §5 grounding: full OUT-port tap (io space write watch) added when the write-diff is needed;
-- the frame golden (state-only) does not use this file.
local out = io.open(os.getenv("WRITES_OUT") or "writes.csv", "w")
if out then out:setvbuf("no"); out:write("cycle,port,value\n") end
-- ★ §5: attach an I/O-space write tap here (manager.machine.devices[":maincpu"].spaces["io"] :install_write_tap).
