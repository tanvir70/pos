package com.alamin.pos.security;

import com.alamin.pos.entity.IdempotencyRecord;

import java.util.Optional;

public interface IdempotencyService {

    Optional<IdempotencyRecord> findRecord(String key);

    boolean startExecution(String key);

    void complete(String key, int responseCode, String responseBody);

    void remove(String key);
}
