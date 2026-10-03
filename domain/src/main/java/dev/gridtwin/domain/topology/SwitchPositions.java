package dev.gridtwin.domain.topology;

import java.util.HashMap;
import java.util.Map;

public record SwitchPositions(Map<String, Position> byId) {

    public SwitchPositions {
        byId = Map.copyOf(byId);
    }

    public Position of(String switchId) {
        Position position = this.byId.get(switchId);
        if (position == null) {
            throw new IllegalArgumentException("no position for switch " + switchId);
        }
        return position;
    }

    public boolean isClosed(String switchId) {
        return this.of(switchId) == Position.CLOSED;
    }

    public SwitchPositions with(String switchId, Position position) {
        Map<String, Position> copy = new HashMap<>(this.byId);
        copy.put(switchId, position);
        return new SwitchPositions(copy);
    }
}
