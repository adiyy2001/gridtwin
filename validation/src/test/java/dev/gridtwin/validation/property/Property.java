package dev.gridtwin.validation.property;

import java.util.Optional;
import java.util.Random;
import java.util.stream.Stream;

public final class Property<T> {

    public static final String SEED_PROPERTY = "gridtwin.property.seed";
    public static final String TRIES_PROPERTY = "gridtwin.property.tries";
    public static final long DEFAULT_SEED = 20261003L;
    public static final int DEFAULT_TRIES = 200;
    private static final int MAX_SHRINK_ROUNDS = 500;

    private final String name;
    private final Generator<T> generator;
    private final Check<T> check;
    private final int tries;
    private final long seed;
    private final Optional<Shrinker<T>> shrinker;

    private Property(
            String name,
            Generator<T> generator,
            Check<T> check,
            int tries,
            long seed,
            Optional<Shrinker<T>> shrinker) {
        this.name = name;
        this.generator = generator;
        this.check = check;
        this.tries = tries;
        this.seed = seed;
        this.shrinker = shrinker;
    }

    public static <T> Property<T> forAll(String name, Generator<T> generator, Check<T> check) {
        return new Property<>(
                name,
                generator,
                check,
                Integer.getInteger(TRIES_PROPERTY, DEFAULT_TRIES),
                Long.getLong(SEED_PROPERTY, DEFAULT_SEED),
                Optional.empty());
    }

    public Property<T> withTries(int newTries) {
        return new Property<>(
                this.name, this.generator, this.check, newTries, this.seed, this.shrinker);
    }

    public Property<T> withSeed(long newSeed) {
        return new Property<>(
                this.name, this.generator, this.check, this.tries, newSeed, this.shrinker);
    }

    public Property<T> shrinkingWith(Shrinker<T> newShrinker) {
        return new Property<>(
                this.name,
                this.generator,
                this.check,
                this.tries,
                this.seed,
                Optional.of(newShrinker));
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
        T smallest = input;
        Throwable smallestCause = cause;
        if (this.shrinker.isPresent()) {
            Shrunk<T> shrunk = this.shrink(this.shrinker.get(), input, cause);
            smallest = shrunk.input();
            smallestCause = shrunk.cause();
        }
        String shrinkNote = smallest == input ? "" : " It was shrunk from " + input + ".";
        String message =
                ("property '%s' failed for seed %d with input %s.%s Repeat it with -D%s=%d"
                                + " -D%s=1. Cause: %s")
                        .formatted(
                                this.name,
                                attemptSeed,
                                smallest,
                                shrinkNote,
                                SEED_PROPERTY,
                                attemptSeed,
                                TRIES_PROPERTY,
                                String.valueOf(smallestCause.getMessage())
                                        .strip()
                                        .replaceAll("\\s+", " "));
        return new AssertionError(message, smallestCause);
    }

    private Shrunk<T> shrink(Shrinker<T> candidates, T input, Throwable cause) {
        T current = input;
        Throwable currentCause = cause;
        for (int round = 0; round < MAX_SHRINK_ROUNDS; round++) {
            Optional<Shrunk<T>> smaller = this.firstFailingCandidate(candidates, current);
            if (smaller.isEmpty()) {
                break;
            }
            current = smaller.get().input();
            currentCause = smaller.get().cause();
        }
        return new Shrunk<>(current, currentCause);
    }

    private Optional<Shrunk<T>> firstFailingCandidate(Shrinker<T> candidates, T current) {
        return candidates
                .shrink(current)
                .flatMap(
                        candidate -> {
                            try {
                                this.check.verify(candidate);
                                return Stream.<Shrunk<T>>empty();
                            } catch (Discard discard) {
                                return Stream.<Shrunk<T>>empty();
                            } catch (AssertionError | RuntimeException failure) {
                                return Stream.of(new Shrunk<>(candidate, failure));
                            }
                        })
                .findFirst();
    }

    private record Shrunk<T>(T input, Throwable cause) {}
}
