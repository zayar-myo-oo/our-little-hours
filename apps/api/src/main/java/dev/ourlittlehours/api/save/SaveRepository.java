package dev.ourlittlehours.api.save;

import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class SaveRepository {
    private final JdbcClient jdbc;
    public SaveRepository(JdbcClient jdbc) { this.jdbc = jdbc; }

    public Optional<String> find(String guestId) {
        return jdbc.sql("SELECT data FROM guest_save WHERE guest_id = ?").param(guestId).query(String.class).optional();
    }

    public void upsert(String guestId, String json) {
        int n = jdbc.sql("UPDATE guest_save SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE guest_id = ?").params(json, guestId).update();
        if (n == 0) jdbc.sql("INSERT INTO guest_save (guest_id, data) VALUES (?, ?)").params(guestId, json).update();
    }
}
