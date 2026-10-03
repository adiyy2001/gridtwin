package dev.gridtwin.api.websocket;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.gridtwin.api.dto.VersionedStateDto;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
public class StateMessages {

    private final ObjectMapper mapper;

    @Inject
    public StateMessages(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public String write(VersionedStateDto state) {
        try {
            return this.mapper.writeValueAsString(state);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("the state cannot be written as JSON", exception);
        }
    }
}
