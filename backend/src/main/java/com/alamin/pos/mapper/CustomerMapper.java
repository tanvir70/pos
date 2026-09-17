package com.alamin.pos.mapper;

import com.alamin.pos.dto.CustomerDto;
import com.alamin.pos.dto.CustomerLedgerEntryDto;
import com.alamin.pos.dto.CustomerResponseDto;
import com.alamin.pos.entity.Customer;
import com.alamin.pos.entity.CustomerLedger;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper(componentModel = "spring")
public interface CustomerMapper {

    CustomerDto toDto(Customer customer);

    Customer toEntity(CustomerDto customerDto);

    List<CustomerDto> toDtoList(List<Customer> customers);

    CustomerResponseDto toResponseDto(Customer customer);

    List<CustomerResponseDto> toResponseDtoList(List<Customer> customers);

    @Mapping(source = "customer.id", target = "customerId")
    @Mapping(source = "customer.name", target = "customerName")
    CustomerLedgerEntryDto toLedgerEntryDto(CustomerLedger ledger);

    List<CustomerLedgerEntryDto> toLedgerEntryDtoList(List<CustomerLedger> ledgers);
}
