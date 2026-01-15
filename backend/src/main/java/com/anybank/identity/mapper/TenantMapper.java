package com.anybank.identity.mapper;

import com.anybank.identity.dto.TenantDto;
import com.anybank.identity.entity.Tenant;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * MapStruct mapper for Tenant entity ↔ TenantDto conversion.
 */
@Mapper(componentModel = "spring")
public interface TenantMapper {

    @Mapping(target = "role", ignore = true)
    TenantDto toDto(Tenant entity);

    @Mapping(target = "metadata", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    Tenant toEntity(TenantDto dto);
}
