import React, { useEffect, useRef } from "react";
import { useRoom } from "../context/RoomContext";
import { abilityOverlayBus } from "./internal";
import { isImmediateKind } from "./engine";

/**
 * Watches `room.abilityEffects` and turns lifecycle changes into game feel:
 *  - any NEW effect fires the cinematic overlay for every client exactly once;
 *  - a pending IMMEDIATE kind (boost/steal/tax/halve) is resolved by the host.
 * Mounted globally inside <RoomProvider> via DelightLayer.
 */
export const AbilityWatcher: React.FC = () => {
  const { room, myId, applyImmediateAbility } = useRoom();
  const knownRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!room) return;
    const effects = room.abilityEffects;
    if (!effects) return;

    const known = knownRef.current;
    for (const [pid, fx] of Object.entries(effects)) {
      if (known.has(fx.id)) continue;
      known.add(fx.id);

      // Cinematic for everyone the moment an ability lands.
      const player = room.players[fx.playerId];
      abilityOverlayBus.emit({
        id: fx.id,
        abilityId: fx.abilityId,
        playerId: fx.playerId,
        playerName: player?.name ?? "Player",
        animation: fx.kind ?? "",
      });

      // The host resolves instant effects (boost / steal / halve / tax).
      if (room.hostId === myId && fx.status === "pending" && isImmediateKind(fx.kind)) {
        applyImmediateAbility(pid);
      }
    }
    // Only `abilityEffects` transitions matter; `room`/`room.players` are
    // read fresh each run, so they're intentionally excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.abilityEffects, room?.hostId, myId, applyImmediateAbility]);

  return null;
};