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
    # We use find to locate initdb as the directory name might vary
    if [ -d "/nix/store" ]; then
        INITDB_PATH=$(find /nix/store -name initdb -type f -executable -print -quit 2>/dev/null)
        if [ -n "$INITDB_PATH" ]; then
            echo "Found initdb at $INITDB_PATH"
            PG_BIN_DIR=$(dirname "$INITDB_PATH")
            export PATH="$PG_BIN_DIR:$PATH"
        fi
    fi

    if ! command -v initdb &> /dev/null; then
        echo "WARNING: PostgreSQL binaries not found in PATH or /nix/store."
        echo "Contents of /nix/store matching postgres:"
        ls -d /nix/store/*postgres* 2>/dev/null || echo "No match found."

        echo "Attempting to install PostgreSQL..."
        if command -v apt-get &> /dev/null; then
           echo "Detected apt-get. Trying to install postgresql..."
           # We might not have sudo, but if we are root it works. If not, it fails.
           apt-get update && apt-get install -y postgresql || echo "Failed to install postgresql via apt-get"
        elif command -v apk &> /dev/null; then
           echo "Detected apk. Trying to install postgresql..."
           apk add postgresql || echo "Failed to install postgresql via apk"
        else
           echo "No package manager found or unable to install."
        fi

        # Check again
        if ! command -v initdb &> /dev/null; then
             # Try to find it again, apt installs to /usr/lib/postgresql/x/bin sometimes not in path
             PG_UBUNTU_BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | head -n 1)
             if [ -n "$PG_UBUNTU_BIN" ]; then
                 export PATH="$PG_UBUNTU_BIN:$PATH"
             fi
        fi
    fi
fi

if ! command -v initdb &> /dev/null; then
    echo "ERROR: initdb command not found. Cannot start PostgreSQL."
    exit 1
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
# Look for pg_ctl if not in path (it should be where initdb is)
if ! command -v pg_ctl &> /dev/null; then
    # Try to find it in same dir as initdb
    INITDB_LOC=$(command -v initdb)
    BIN_DIR=$(dirname "$INITDB_LOC")
    if [ -f "$BIN_DIR/pg_ctl" ]; then
        export PATH="$BIN_DIR:$PATH"
    fi
fi

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
