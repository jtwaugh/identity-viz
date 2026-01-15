package com.anybank.identity.mapper;

import com.anybank.identity.dto.AccountDto;
import com.anybank.identity.entity.Account;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * MapStruct mapper for Account entity ↔ AccountDto conversion.
 */
@Mapper(componentModel = "spring")
public interface AccountMapper {

    @Mapping(source = "tenant.id", target = "tenantId")
    AccountDto toDto(Account entity);

    @Mapping(target = "tenant", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    Account toEntity(AccountDto dto);
}
