package dev.gridtwin.validation.property;

@FunctionalInterface
public interface Check<T> {

    void verify(T input);
}
