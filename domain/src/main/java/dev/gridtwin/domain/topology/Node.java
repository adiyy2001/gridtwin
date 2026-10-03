package dev.gridtwin.domain.topology;

public record Node(String id) {

    public Node {
        if (id == null || id.isBlank()) {
            throw new IllegalArgumentException("node id must not be blank");
        }
    }
}
