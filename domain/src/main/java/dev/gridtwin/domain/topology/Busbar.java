package dev.gridtwin.domain.topology;

public record Busbar(String nodeId, int busNumber, String name, int row) {

    public Busbar {
        if (busNumber <= 0) {
            throw new IllegalArgumentException("busbar bus number must be positive: " + busNumber);
        }
    }
}
