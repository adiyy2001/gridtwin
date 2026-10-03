package dev.gridtwin.validation.property;

import java.util.Random;

@FunctionalInterface
public interface Generator<T> {

    T generate(Random random);
}
