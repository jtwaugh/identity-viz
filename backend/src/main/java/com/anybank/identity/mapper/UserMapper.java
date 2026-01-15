package com.anybank.identity.mapper;

import com.anybank.identity.dto.UserDto;
import com.anybank.identity.entity.User;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * MapStruct mapper for User entity ↔ UserDto conversion.
 */
@Mapper(componentModel = "spring")
public interface UserMapper {

    @Mapping(target = "tenants", ignore = true)
    UserDto toDto(User entity);

    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    User toEntity(UserDto dto);
}
