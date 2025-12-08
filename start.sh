#!/bin/bash
set -e

# Deployment script to build and start the application with PostgreSQL
echo "Starting deployment script..."

# Build Frontend
echo "Building Frontend..."
cd frontend
npm install
npm run build
cd ..

# Build Backend
echo "Building Backend..."
cd backend
npm install
npm run build
cd ..

# Setup PostgreSQL
# Ensure PostgreSQL binaries are in the PATH
if ! command -v initdb &> /dev/null; then
    echo "initdb not found in PATH. Searching in /nix/store..."
    # Find the bin directory containing initdb
    # We use a loop to check each potential directory
    for dir in $(ls -d /nix/store/*-postgresql-*/bin 2>/dev/null); do
        if [ -x "$dir/initdb" ]; then
            echo "Found PostgreSQL binaries at $dir"
            export PATH="$dir:$PATH"
            break
        fi
    done

    if ! command -v initdb &> /dev/null; then
        echo "WARNING: PostgreSQL binaries not found in PATH or /nix/store."
    fi
fi

export PGDATA=/app/postgres_data
export PGHOST=localhost
export PGPORT=5432
export PGUSER=admin
export PGPASSWORD=password
export PGDATABASE=cic_docflow

echo "Setting up PostgreSQL..."
if [ ! -d "$PGDATA" ]; then
    echo "Initializing PostgreSQL database..."
    mkdir -p "$PGDATA"
    initdb -D "$PGDATA" --auth=trust
fi

echo "Starting PostgreSQL..."
pg_ctl -D "$PGDATA" -l "$PGDATA/logfile" -o "-p $PGPORT" start

echo "Waiting for PostgreSQL to be ready..."
until pg_isready -h localhost -p $PGPORT; do
  echo "Waiting for postgres..."
  sleep 1
done

# Create User and Database
# The user running this script is the superuser for the DB instance we just created.
# We connect to 'postgres' database which is created by default.

# Check if 'admin' role exists
if ! psql -h localhost -p $PGPORT -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='$PGUSER'" | grep -q 1; then
    echo "Creating user $PGUSER..."
    psql -h localhost -p $PGPORT -d postgres -c "CREATE USER $PGUSER WITH SUPERUSER PASSWORD '$PGPASSWORD';"
fi

# Check if database exists
if ! psql -h localhost -p $PGPORT -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$PGDATABASE'" | grep -q 1; then
    echo "Creating database $PGDATABASE..."
    psql -h localhost -p $PGPORT -d postgres -c "CREATE DATABASE $PGDATABASE OWNER $PGUSER;"
fi

echo "Applying schema..."
psql -h localhost -p $PGPORT -U $PGUSER -d $PGDATABASE -f db/schema.sql

# Start Backend
echo "Starting Backend..."
cd backend
npm run start
