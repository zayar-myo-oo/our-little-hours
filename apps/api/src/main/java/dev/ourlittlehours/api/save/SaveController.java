package dev.ourlittlehours.api.save;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

/** Foundation for optional cloud saves. The web client currently saves to IndexedDB only. */
@RestController
@RequestMapping("/api/saves")
@Validated
public class SaveController {
    private final SaveRepository repo;
    public SaveController(SaveRepository repo) { this.repo = repo; }

    @GetMapping("/{guestId}")
    public ResponseEntity<String> get(@PathVariable @Pattern(regexp = "[A-Za-z0-9-]{8,64}") String guestId) {
        return repo.find(guestId).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping(value = "/{guestId}", consumes = "application/json")
    public ResponseEntity<Void> put(@PathVariable @Pattern(regexp = "[A-Za-z0-9-]{8,64}") String guestId,
                                    @RequestBody @Size(max = 512_000) String json) {
        repo.upsert(guestId, json);
        return ResponseEntity.noContent().build();
    }
}
