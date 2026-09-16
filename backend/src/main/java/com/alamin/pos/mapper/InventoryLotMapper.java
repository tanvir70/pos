package com.alamin.pos.mapper;

import com.alamin.pos.dto.InventoryLotDto;
import com.alamin.pos.entity.InventoryLot;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper(componentModel = "spring")
public interface InventoryLotMapper {

    @Mapping(source = "product.id", target = "productId")
    @Mapping(source = "product.productCode", target = "productCode")
    @Mapping(source = "product.nameEn", target = "productNameEn")
    InventoryLotDto toDto(InventoryLot lot);

    @Mapping(target = "product", ignore = true)
    InventoryLot toEntity(InventoryLotDto dto);

    List<InventoryLotDto> toDtoList(List<InventoryLot> lots);
}
