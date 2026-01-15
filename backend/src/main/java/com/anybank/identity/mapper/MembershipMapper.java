package com.anybank.identity.mapper;

import com.anybank.identity.dto.TenantDto;
import com.anybank.identity.entity.Membership;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * MapStruct mapper for Membership entity conversion.
 *
 * Maps Membership to TenantDto with role information included.
 */
@Mapper(componentModel = "spring", uses = {TenantMapper.class})
public interface MembershipMapper {

    /**
     * Convert a Membership to a TenantDto, including the user's role.
     */
    @Mapping(source = "tenant.id", target = "id")
    @Mapping(source = "tenant.externalId", target = "externalId")
    @Mapping(source = "tenant.name", target = "name")
    @Mapping(source = "tenant.type", target = "type")
    @Mapping(source = "tenant.status", target = "status")
    @Mapping(source = "tenant.createdAt", target = "createdAt")
    @Mapping(source = "role", target = "role")
    TenantDto toTenantDtoWithRole(Membership membership);
}
