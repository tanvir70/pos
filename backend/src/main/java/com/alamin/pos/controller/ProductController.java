package com.alamin.pos.controller;

import com.alamin.pos.dto.ProductDto;
import com.alamin.pos.entity.Product;
import com.alamin.pos.mapper.ProductMapper;
import com.alamin.pos.repository.ProductRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ProductController {

    private final ProductRepository productRepository;
    private final ProductMapper productMapper;

    // BUSINESS DECISION: Product catalog REST endpoint enables frontend to retrieve all products
    // or filter by English/Bengali name, and create new products directly in the database.
    @GetMapping
    public ResponseEntity<List<ProductDto>> getAllProducts(
            @RequestParam(name = "query", required = false) String query) {
        List<Product> products;
        if (query != null && !query.trim().isEmpty()) {
            products = productRepository.findByNameEnContainingIgnoreCaseOrNameBnContainingIgnoreCase(
                    query.trim(), query.trim());
        } else {
            products = productRepository.findAll();
        }
        return ResponseEntity.ok(productMapper.toDtoList(products));
    }

    @PostMapping
    public ResponseEntity<ProductDto> createProduct(@Valid @RequestBody ProductDto dto) {
        Product entity = productMapper.toEntity(dto);
        Product saved = productRepository.save(entity);
        return ResponseEntity.status(HttpStatus.CREATED).body(productMapper.toDto(saved));
    }
}
