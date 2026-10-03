package dev.gridtwin.api.dto;

import dev.gridtwin.domain.topology.Position;
import dev.gridtwin.domain.topology.Switch;
import dev.gridtwin.domain.topology.SwitchKind;

public record SwitchDto(
        String id,
        SwitchKind kind,
        String bay,
        String nodeA,
        String nodeB,
        Position initialPosition) {

    public static SwitchDto from(Switch candidate) {
        return new SwitchDto(
                candidate.id(),
                candidate.kind(),
                candidate.bayId(),
                candidate.nodeA(),
                candidate.nodeB(),
                candidate.initialPosition());
    }
}
