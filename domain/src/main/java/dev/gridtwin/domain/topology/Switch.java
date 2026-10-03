package dev.gridtwin.domain.topology;

public record Switch(
        String id,
        SwitchKind kind,
        String bayId,
        String nodeA,
        String nodeB,
        Position initialPosition) {

    public static final String EARTH = "EARTH";

    public Switch {
        if (id == null || id.isBlank()) {
            throw new IllegalArgumentException("switch id must not be blank");
        }
        if (kind == SwitchKind.EARTHING_SWITCH && !EARTH.equals(nodeB)) {
            throw new IllegalArgumentException("earthing switch " + id + " must end at " + EARTH);
        }
        if (kind != SwitchKind.EARTHING_SWITCH && EARTH.equals(nodeB)) {
            throw new IllegalArgumentException("only an earthing switch may end at " + EARTH);
        }
        if (nodeA.equals(nodeB)) {
            throw new IllegalArgumentException("switch " + id + " joins a node to itself");
        }
    }

    public boolean isEarthing() {
        return this.kind == SwitchKind.EARTHING_SWITCH;
    }
}
