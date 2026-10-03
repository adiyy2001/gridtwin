package dev.gridtwin.api.arch;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.Architectures.layeredArchitecture;
import static com.tngtech.archunit.library.dependencies.SlicesRuleDefinition.slices;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import org.junit.jupiter.api.Test;

class ArchitectureTest {

    private static final String DOMAIN = "dev.gridtwin.domain..";
    private static final String CASES = "dev.gridtwin.cases..";
    private static final String API = "dev.gridtwin.api..";

    private static final JavaClasses CLASSES =
            new ClassFileImporter()
                    .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
                    .importPackages("dev.gridtwin");

    @Test
    void theDomainImportsNoFrameworkAndNoOuterModule() {
        noClasses()
                .that()
                .resideInAPackage(DOMAIN)
                .should()
                .dependOnClassesThat()
                .resideInAnyPackage(
                        "jakarta..",
                        "io.quarkus..",
                        "io.vertx..",
                        "io.smallrye..",
                        "org.eclipse.microprofile..",
                        "org.jboss..",
                        "com.fasterxml..",
                        CASES,
                        API,
                        "dev.gridtwin.bench..")
                .check(CLASSES);
    }

    @Test
    void casesDependOnTheDomainOnly() {
        noClasses()
                .that()
                .resideInAPackage(CASES)
                .should()
                .dependOnClassesThat()
                .resideInAnyPackage(API, "io.quarkus..", "jakarta..")
                .check(CLASSES);
    }

    @Test
    void theApiLayersPointInwardOnly() {
        layeredArchitecture()
                .consideringOnlyDependenciesInLayers()
                .layer("rest")
                .definedBy("dev.gridtwin.api.rest..")
                .layer("websocket")
                .definedBy("dev.gridtwin.api.websocket..")
                .layer("error")
                .definedBy("dev.gridtwin.api.error..")
                .layer("dto")
                .definedBy("dev.gridtwin.api.dto..")
                .layer("adapter")
                .definedBy("dev.gridtwin.api.adapter..")
                .layer("config")
                .definedBy("dev.gridtwin.api.config..")
                .whereLayer("rest")
                .mayOnlyBeAccessedByLayers("config")
                .whereLayer("websocket")
                .mayOnlyBeAccessedByLayers("config")
                .whereLayer("error")
                .mayOnlyBeAccessedByLayers("config")
                .whereLayer("adapter")
                .mayOnlyBeAccessedByLayers("rest", "config")
                .whereLayer("dto")
                .mayOnlyBeAccessedByLayers("rest", "websocket", "error", "adapter", "config")
                .whereLayer("config")
                .mayNotBeAccessedByAnyLayer()
                .check(CLASSES);
    }

    @Test
    void dtosKnowNothingOfTheAdaptersThatCarryThem() {
        noClasses()
                .that()
                .resideInAPackage("dev.gridtwin.api.dto..")
                .should()
                .dependOnClassesThat()
                .resideInAnyPackage(
                        "dev.gridtwin.api.rest..",
                        "dev.gridtwin.api.websocket..",
                        "dev.gridtwin.api.adapter..",
                        "dev.gridtwin.api.config..",
                        "io.quarkus..",
                        "org.jboss..")
                .check(CLASSES);
    }

    @Test
    void restAndWebSocketAdaptersDoNotDependOnEachOther() {
        noClasses()
                .that()
                .resideInAPackage("dev.gridtwin.api.rest..")
                .should()
                .dependOnClassesThat()
                .resideInAPackage("dev.gridtwin.api.websocket..")
                .check(CLASSES);
        noClasses()
                .that()
                .resideInAPackage("dev.gridtwin.api.websocket..")
                .should()
                .dependOnClassesThat()
                .resideInAPackage("dev.gridtwin.api.rest..")
                .check(CLASSES);
    }

    @Test
    void thereAreNoPackageCyclesInTheDomain() {
        slices().matching("dev.gridtwin.domain.(*)..").should().beFreeOfCycles().check(CLASSES);
    }

    @Test
    void failuresAndPortsAreDefinedByTheDomain() {
        classes()
                .that()
                .implement(dev.gridtwin.domain.application.StatePublisher.class)
                .or()
                .implement(dev.gridtwin.domain.application.SessionRepository.class)
                .or()
                .implement(dev.gridtwin.domain.application.ModelCatalog.class)
                .should()
                .resideInAPackage("dev.gridtwin.api.(adapter|websocket)..")
                .check(CLASSES);
    }

    @Test
    void theDomainDoesNotPrintToTheConsole() {
        noClasses()
                .that()
                .resideInAPackage(DOMAIN)
                .should()
                .accessField(System.class, "out")
                .check(CLASSES);
    }
}
