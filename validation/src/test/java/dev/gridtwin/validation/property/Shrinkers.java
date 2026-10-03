package dev.gridtwin.validation.property;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;
import java.util.stream.Stream;

public final class Shrinkers {

    private Shrinkers() {}

    public static <E> Shrinker<List<E>> list() {
        return Shrinkers::smallerLists;
    }

    private static <E> Stream<List<E>> smallerLists(List<E> input) {
        if (input.size() <= 1) {
            return Stream.empty();
        }
        int half = input.size() / 2;
        Stream<List<E>> halves =
                Stream.of(
                        List.copyOf(input.subList(0, half)),
                        List.copyOf(input.subList(half, input.size())));
        Stream<List<E>> withoutOne =
                IntStream.range(0, input.size()).mapToObj(index -> withoutIndex(input, index));
        return Stream.concat(halves, withoutOne);
    }

    private static <E> List<E> withoutIndex(List<E> input, int index) {
        List<E> copy = new ArrayList<>(input);
        copy.remove(index);
        return List.copyOf(copy);
    }
}
