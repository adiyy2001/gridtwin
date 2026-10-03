package dev.gridtwin.validation.property;

import java.util.stream.Stream;

@FunctionalInterface
public interface Shrinker<T> {

    Stream<T> shrink(T input);
}
