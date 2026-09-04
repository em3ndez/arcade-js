-- SPDX-License-Identifier: GPL-3.0-only
-- Ground the attract credit/high-score reveal anim (handler 0x050e) in MAME.
-- Watches: (a) execution of the handshake chain PCs {0x0aea,0x0b89,0x189e,0x050e,0x0550}
-- via a whole-ROM read tap keyed on CURPC; (b) writes to ATTRACT_ANIM_ACK 0x2055 with
-- (frame, pc, value). Confirms the walker dispatches to 0x050e during attract and that the
-- 0x050e path toggles 0x2055 bit0 (set-then-clear) to complete runHandshakedAttractAnim's spin.
-- Env: OUT (default ground_050e.txt).
local cpu = manager.machine.devices[":maincpu"]
local sp = cpu.spaces["program"]
local OUT = os.getenv("OUT") or "ground_050e.txt"

local watch = {[0x0aea]=true,[0x0b89]=true,[0x189e]=true,[0x050e]=true,[0x0550]=true}
local execHits = {}   -- pc -> {firstFrame, count}
local ackWrites = {}  -- ordered list of {frame,pc,val}
local frame = 0

_G.__gtap = sp:install_read_tap(0x0000, 0x3fff, "ground050e", function(offset, data, mask)
  local pc = cpu.state["CURPC"].value
  if watch[pc] then
    local e = execHits[pc]
    if e == nil then execHits[pc] = {frame, 1} else e[2] = e[2] + 1 end
  end
  return data
end)

_G.__wtap = sp:install_write_tap(0x2055, 0x2055, "ack050e", function(offset, data, mask)
  local pc = cpu.state["CURPC"].value
  ackWrites[#ackWrites+1] = {frame, pc, data & 0xff}
  return data
end)

_G.__fn = emu.add_machine_frame_notifier(function()
  frame = frame + 1
  if frame % 60 == 0 then
    -- periodic flush so a crash still leaves partial evidence
    local f = io.open(OUT, "w")
    if f then
      f:write(string.format("frames=%d\n", frame))
      local ks = {}
      for pc in pairs(execHits) do ks[#ks+1]=pc end
      table.sort(ks)
      f:write("EXEC (pc firstFrame count):\n")
      for _,pc in ipairs(ks) do f:write(string.format("  %04x  f%d  x%d\n", pc, execHits[pc][1], execHits[pc][2])) end
      f:write(string.format("ACK 0x2055 writes: %d\n", #ackWrites))
      for i=1,#ackWrites do local w=ackWrites[i]; f:write(string.format("  f%d pc=%04x val=%02x bit0=%d\n", w[1],w[2],w[3], w[3] & 1)) end
      f:close()
    end
  end
end)
