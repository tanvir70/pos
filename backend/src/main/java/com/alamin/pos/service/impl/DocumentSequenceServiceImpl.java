package com.alamin.pos.service.impl;

import com.alamin.pos.service.DocumentSequenceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

@Slf4j
@Service
@RequiredArgsConstructor
public class DocumentSequenceServiceImpl implements DocumentSequenceService {

    private final JdbcTemplate jdbcTemplate;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMdd");

    @Override
    public String generateInvoiceNumber() {
        Long nextVal = getNextSequenceValue("invoice_number_seq");
        String datePart = LocalDate.now().format(DATE_FORMATTER);
        return String.format("INV-%s-%06d", datePart, nextVal);
    }

    @Override
    public String generateReturnNumber() {
        Long nextVal = getNextSequenceValue("return_number_seq");
        String datePart = LocalDate.now().format(DATE_FORMATTER);
        return String.format("RET-%s-%06d", datePart, nextVal);
    }

    @Override
    public String generateTransferNumber() {
        Long nextVal = getNextSequenceValue("transfer_number_seq");
        String datePart = LocalDate.now().format(DATE_FORMATTER);
        return String.format("TRF-%s-%06d", datePart, nextVal);
    }

    private Long getNextSequenceValue(String sequenceName) {
        try {
            Long val = jdbcTemplate.queryForObject("SELECT NEXTVAL('" + sequenceName + "')", Long.class);
            return val != null ? val : System.currentTimeMillis() % 1000000;
        } catch (Exception e) {
            log.warn("Failed to retrieve next value from sequence {}. Falling back to timestamp.", sequenceName, e);
            return System.currentTimeMillis() % 1000000;
        }
    }
}
