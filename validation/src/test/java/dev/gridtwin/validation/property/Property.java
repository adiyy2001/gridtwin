package dev.gridtwin.validation.property;

import java.util.Random;

public final class Property<T> {

    public static final String SEED_PROPERTY = "gridtwin.property.seed";
    public static final String TRIES_PROPERTY = "gridtwin.property.tries";
    public static final long DEFAULT_SEED = 20261003L;
    public static final int DEFAULT_TRIES = 200;

    private final String name;
    private final Generator<T> generator;
    private final Check<T> check;
    private final int tries;
    private final long seed;

    private Property(String name, Generator<T> generator, Check<T> check, int tries, long seed) {
        this.name = name;
        this.generator = generator;
        this.check = check;
        this.tries = tries;
        this.seed = seed;
    }

    public static <T> Property<T> forAll(String name, Generator<T> generator, Check<T> check) {
        return new Property<>(
                name,
                generator,
                check,
                Integer.getInteger(TRIES_PROPERTY, DEFAULT_TRIES),
                Long.getLong(SEED_PROPERTY, DEFAULT_SEED));
    }

    public Property<T> withTries(int newTries) {
        return new Property<>(this.name, this.generator, this.check, newTries, this.seed);
    }

    public Property<T> withSeed(long newSeed) {
        return new Property<>(this.name, this.generator, this.check, this.tries, newSeed);
    }

    public void run() {
        int discarded = 0;
        for (int attempt = 0; attempt < this.tries; attempt++) {
            long attemptSeed = this.seed + attempt;
            T input = this.generator.generate(new Random(attemptSeed));
            try {
                this.check.verify(input);
            } catch (Discard discard) {
                discarded++;
            } catch (AssertionError | RuntimeException failure) {
                throw this.failure(attemptSeed, input, failure);
            }
        }
        if (discarded * 2 > this.tries) {
            throw new AssertionError(
                    "property '%s' discarded %d of %d inputs, the generator is too loose"
                            .formatted(this.name, discarded, this.tries));
        }
    }

    private AssertionError failure(long attemptSeed, T input, Throwable cause) {
        String message =
                ("property '%s' failed for seed %d with input %s. Repeat it with -D%s=%d"
                                + " -D%s=1. Cause: %s")
                        .formatted(
                                this.name,
                                attemptSeed,
                                input,
                                SEED_PROPERTY,
                                attemptSeed,
                                TRIES_PROPERTY,
                                cause.getMessage());
        return new AssertionError(message, cause);
    }
}
