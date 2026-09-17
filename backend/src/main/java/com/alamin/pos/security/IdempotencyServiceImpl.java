package com.alamin.pos.security;

import com.alamin.pos.entity.IdempotencyRecord;
import com.alamin.pos.repository.IdempotencyRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class IdempotencyServiceImpl implements IdempotencyService {

    private final IdempotencyRecordRepository repository;

    @Override
    @Transactional(readOnly = true)
    public Optional<IdempotencyRecord> findRecord(String key) {
        return repository.findById(key);
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean startExecution(String key) {
        try {
            if (repository.existsById(key)) {
                return false;
            }
            IdempotencyRecord record = IdempotencyRecord.builder()
                    .id(key)
                    .status("IN_PROGRESS")
                    .createdAt(LocalDateTime.now())
                    .build();
            repository.saveAndFlush(record);
            return true;
        } catch (DataIntegrityViolationException e) {
            return false;
        }
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void complete(String key, int responseCode, String responseBody) {
        repository.findById(key).ifPresent(record -> {
            record.setStatus("COMPLETED");
            record.setResponseCode(responseCode);
            record.setResponseBody(responseBody);
            repository.saveAndFlush(record);
        });
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void remove(String key) {
        try {
            repository.deleteById(key);
            repository.flush();
        } catch (Exception ignored) {
        }
    }
}
