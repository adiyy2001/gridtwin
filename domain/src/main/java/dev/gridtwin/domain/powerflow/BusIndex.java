package dev.gridtwin.domain.powerflow;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public final class BusIndex {

    private final int[] numbers;
    private final Map<Integer, Integer> positions;

    private BusIndex(int[] numbers) {
        this.numbers = numbers;
        this.positions = new HashMap<>();
        for (int position = 0; position < numbers.length; position++) {
            this.positions.put(numbers[position], position);
        }
    }

    public static BusIndex of(List<Integer> busNumbers) {
        return new BusIndex(busNumbers.stream().mapToInt(Integer::intValue).toArray());
    }

    public int size() {
        return this.numbers.length;
    }

    public int numberAt(int position) {
        return this.numbers[position];
    }

    public Optional<Integer> positionOf(int busNumber) {
        return Optional.ofNullable(this.positions.get(busNumber));
    }

    public int requirePosition(int busNumber) {
        return this.positionOf(busNumber)
                .orElseThrow(() -> new IllegalArgumentException("unknown bus " + busNumber));
    }

    public boolean contains(int busNumber) {
        return this.positions.containsKey(busNumber);
    }
}
