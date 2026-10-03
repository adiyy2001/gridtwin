package dev.gridtwin.validation.property;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class PropertyTest {

    @Test
    void aTruePropertyRunsEveryTry() {
        List<Integer> seen = new ArrayList<>();

        Property.forAll("always true", random -> random.nextInt(100), seen::add)
                .withTries(50)
                .run();

        assertThat(seen).hasSize(50);
    }

    @Test
    void theSameSeedGeneratesTheSameInputs() {
        List<Integer> first = new ArrayList<>();
        List<Integer> second = new ArrayList<>();

        Property.forAll("first", random -> random.nextInt(), first::add)
                .withSeed(7L)
                .withTries(20)
                .run();
        Property.forAll("second", random -> random.nextInt(), second::add)
                .withSeed(7L)
                .withTries(20)
                .run();

        assertThat(first).isEqualTo(second);
    }

    @Test
    void aFailureNamesTheSeedTheInputAndHowToRepeatIt() {
        Property<Integer> property =
                Property.forAll(
                                "small numbers",
                                random -> random.nextInt(1000),
                                value -> assertThat(value).isLessThan(500))
                        .withSeed(1L)
                        .withTries(200);

        assertThatThrownBy(property::run)
                .isInstanceOf(AssertionError.class)
                .hasMessageContaining("small numbers")
                .hasMessageContaining("seed")
                .hasMessageContaining("-D" + Property.SEED_PROPERTY + "=")
                .hasMessageContaining("-D" + Property.TRIES_PROPERTY + "=1");
    }

    @Test
    void theSeedInTheFailureMessageRepeatsTheFailure() {
        Check<Integer> check = value -> assertThat(value).isLessThan(500);
        Generator<Integer> generator = random -> random.nextInt(1000);
        String message =
                catchMessage(
                        Property.forAll("repeatable", generator, check)
                                .withSeed(3L)
                                .withTries(100));
        long failingSeed = Long.parseLong(message.replaceAll(".*for seed (\\d+) .*", "$1").trim());

        assertThatThrownBy(
                        () ->
                                Property.forAll("repeat", generator, check)
                                        .withSeed(failingSeed)
                                        .withTries(1)
                                        .run())
                .isInstanceOf(AssertionError.class);
    }

    @Test
    void aRuntimeExceptionInTheCheckIsReportedAsAFailureToo() {
        Property<Integer> property =
                Property.forAll(
                        "throws",
                        random -> random.nextInt(),
                        value -> {
                            throw new IllegalStateException("boom");
                        });

        assertThatThrownBy(property::run)
                .isInstanceOf(AssertionError.class)
                .hasMessageContaining("boom")
                .hasCauseInstanceOf(IllegalStateException.class);
    }

    @Test
    void discardedInputsDoNotCountAsFailures() {
        Property.forAll(
                        "mostly valid",
                        random -> random.nextInt(10),
                        value -> Discard.unless(value != 0, "zero"))
                .withTries(100)
                .run();
    }

    @Test
    void aGeneratorThatMostlyProducesDiscardsIsReported() {
        Property<Integer> property =
                Property.forAll(
                                "too loose",
                                random -> random.nextInt(10),
                                value -> Discard.unless(value == 0, "not zero"))
                        .withTries(100);

        assertThatThrownBy(property::run).hasMessageContaining("discarded");
    }

    @Test
    void aFailingListIsShrunkToTheSmallestListThatStillFails() {
        Property<List<Integer>> property =
                Property.forAll(
                                "no large element",
                                random -> random.ints(20, 0, 100).boxed().toList(),
                                values -> assertThat(values).allMatch(value -> value < 95))
                        .shrinkingWith(Shrinkers.list())
                        .withSeed(5L)
                        .withTries(50);

        String message = catchMessage(property);

        assertThat(message).contains("It was shrunk from");
        assertThat(message).containsPattern("with input \\[9[5-9]\\]\\.");
    }

    @Test
    void shrinkingKeepsTheFailureAndIgnoresDiscardedCandidates() {
        Property<List<Integer>> property =
                Property.forAll(
                                "needs two elements",
                                random -> List.of(1, 2, 3, 4, 5, 6),
                                values -> {
                                    Discard.unless(values.size() > 1, "too short");
                                    assertThat(values).hasSizeLessThan(2);
                                })
                        .shrinkingWith(Shrinkers.list())
                        .withTries(1);

        String message = catchMessage(property);

        assertThat(message).containsPattern("with input \\[\\d, \\d\\]\\.");
    }

    @Test
    void anInputThatCannotBeShrunkIsReportedAsItIs() {
        Property<List<Integer>> property =
                Property.forAll(
                                "single element",
                                random -> List.of(7),
                                values -> assertThat(values).isEmpty())
                        .shrinkingWith(Shrinkers.list())
                        .withTries(1);

        assertThat(catchMessage(property)).doesNotContain("shrunk");
    }

    @Test
    void listShrinkingOffersHalvesAndEveryRemovalAndNothingForSmallLists() {
        List<List<Integer>> candidates =
                Shrinkers.<Integer>list().shrink(List.of(1, 2, 3, 4)).toList();

        assertThat(candidates)
                .containsExactly(
                        List.of(1, 2),
                        List.of(3, 4),
                        List.of(2, 3, 4),
                        List.of(1, 3, 4),
                        List.of(1, 2, 4),
                        List.of(1, 2, 3));
        assertThat(Shrinkers.<Integer>list().shrink(List.of(1))).isEmpty();
        assertThat(Shrinkers.<Integer>list().shrink(List.of())).isEmpty();
    }

    private static String catchMessage(Property<?> property) {
        try {
            property.run();
            return "";
        } catch (AssertionError failure) {
            return failure.getMessage().replace('\n', ' ');
        }
    }
}
