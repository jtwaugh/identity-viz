#!/bin/bash
# init-db.sh: Initialize multiple databases in PostgreSQL
# This script is executed by the postgres docker-entrypoint-initdb.d mechanism

set -e
set -u

echo "=========================================="
echo "Creating multiple databases for AnyBank"
echo "=========================================="

function create_database() {
    local database=$1
    echo "Creating database: $database"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
        SELECT 'CREATE DATABASE $database'
        WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$database')\gexec
        GRANT ALL PRIVILEGES ON DATABASE $database TO $POSTGRES_USER;
EOSQL
}

# Create the Keycloak database (in addition to the main 'anybank' database)
if [ -n "${POSTGRES_MULTIPLE_DATABASES:-}" ]; then
    echo "Multiple databases requested: $POSTGRES_MULTIPLE_DATABASES"
    for db in $(echo $POSTGRES_MULTIPLE_DATABASES | tr ',' ' '); do
        create_database $db
    done
    echo "Multiple databases created successfully"
fi

echo "=========================================="
echo "Database initialization complete"
echo "=========================================="
