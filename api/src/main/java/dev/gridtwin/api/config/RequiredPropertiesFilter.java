package dev.gridtwin.api.config;

import java.util.List;
import java.util.Map;
import org.eclipse.microprofile.openapi.OASFilter;
import org.eclipse.microprofile.openapi.models.OpenAPI;
import org.eclipse.microprofile.openapi.models.media.Schema;

public class RequiredPropertiesFilter implements OASFilter {

    @Override
    public void filterOpenAPI(OpenAPI openAPI) {
        if (openAPI.getComponents() == null || openAPI.getComponents().getSchemas() == null) {
            return;
        }
        openAPI.getComponents().getSchemas().values().forEach(RequiredPropertiesFilter::require);
    }

    private static void require(Schema schema) {
        Map<String, Schema> properties = schema.getProperties();
        if (properties == null) {
            return;
        }
        properties.entrySet().stream()
                .filter(entry -> !nullable(entry.getValue()))
                .map(Map.Entry::getKey)
                .forEach(schema::addRequired);
    }

    private static boolean nullable(Schema schema) {
        return hasNullType(schema.getType())
                || anyNullable(schema.getOneOf())
                || anyNullable(schema.getAnyOf());
    }

    private static boolean hasNullType(List<Schema.SchemaType> types) {
        return types != null && types.contains(Schema.SchemaType.NULL);
    }

    private static boolean anyNullable(List<Schema> options) {
        return options != null && options.stream().anyMatch(RequiredPropertiesFilter::nullable);
    }
}
