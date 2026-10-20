package dev.ourlittlehours.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class ApiTests {
    @Autowired MockMvc mvc;

    @Test
    void healthIsUp() throws Exception {
        mvc.perform(get("/api/health")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void saveRoundTrip() throws Exception {
        String id = "guest-12345678";
        mvc.perform(get("/api/saves/" + id)).andExpect(status().isNotFound());
        mvc.perform(put("/api/saves/" + id).contentType(MediaType.APPLICATION_JSON).content("{\"a\":1}")).andExpect(status().isNoContent());
        mvc.perform(put("/api/saves/" + id).contentType(MediaType.APPLICATION_JSON).content("{\"a\":2}")).andExpect(status().isNoContent());
        mvc.perform(get("/api/saves/" + id)).andExpect(status().isOk()).andExpect(content().string("{\"a\":2}"));
    }
}
