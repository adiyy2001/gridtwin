package dev.gridtwin.domain.topology;

import java.util.Optional;

public record Bay(String id, String name, BayKind kind, int column, Optional<Terminal> terminal) {

    public Bay {
        if (kind == BayKind.COUPLER && terminal.isPresent()) {
            throw new IllegalArgumentException("coupler bay " + id + " has no equipment terminal");
        }
        if (kind == BayKind.FEEDER && terminal.isEmpty()) {
            throw new IllegalArgumentException("feeder bay " + id + " needs an equipment terminal");
        }
    }
}
