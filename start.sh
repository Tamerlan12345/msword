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
           apt-get update && apt-get install -y postgresql || echo "Failed to install postgresql via apt-get"
        elif command -v apk &> /dev/null; then
           echo "Detected apk. Trying to install postgresql..."
           apk add postgresql || echo "Failed to install postgresql via apk"
        else
           echo "No package manager found or unable to install."
        fi

        # Check again
        if ! command -v initdb &> /dev/null; then
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

# Function to run command as postgres user if running as root
run_as_postgres() {
    local cmd="$1"
    if [ "$(id -u)" = "0" ]; then
        # Ensure postgres user exists
        if ! id "postgres" &>/dev/null; then
             echo "Creating postgres user..."
             if command -v useradd &> /dev/null; then
                 useradd -m -s /bin/bash postgres
             elif command -v adduser &> /dev/null; then
                 adduser -D postgres
             else
                 echo "Warning: Could not create postgres user. Continuing as root (might fail)..."
             fi
        fi

        # Fix permissions on PGDATA
        if [ -d "$PGDATA" ]; then
            chown -R postgres:postgres "$PGDATA"
            chmod 700 "$PGDATA"
        else
            mkdir -p "$PGDATA"
            chown -R postgres:postgres "$PGDATA"
            chmod 700 "$PGDATA"
        fi

        # Create logfile if needed so postgres can write to it
        if [ ! -f "$PGDATA/logfile" ]; then
            touch "$PGDATA/logfile"
            chown postgres:postgres "$PGDATA/logfile"
        fi

        # Run as postgres user, preserving PATH
        su postgres -c "export PATH='$PATH'; $cmd"
    else
        # Not running as root, just execute
        eval "$cmd"
    fi
}

if [ -s "$PGDATA/PG_VERSION" ]; then
    echo "PostgreSQL cluster already exists (PG_VERSION found)."
else
    echo "No valid PostgreSQL cluster found at $PGDATA. Preparing for initialization..."
    # If directory exists but no PG_VERSION, it's likely leftovers or invalid.
    # We should clean it to ensure initdb succeeds.
    if [ -d "$PGDATA" ]; then
        echo "WARNING: Directory $PGDATA exists but is not a valid cluster. Cleaning up..."
        rm -rf "$PGDATA"
    fi

    echo "Initializing PostgreSQL database..."
    mkdir -p "$PGDATA"
    run_as_postgres "initdb -D '$PGDATA' --auth=trust"
fi

echo "Starting PostgreSQL..."
if ! command -v pg_ctl &> /dev/null; then
    INITDB_LOC=$(command -v initdb)
    BIN_DIR=$(dirname "$INITDB_LOC")
    if [ -f "$BIN_DIR/pg_ctl" ]; then
        export PATH="$BIN_DIR:$PATH"
    fi
fi

run_as_postgres "pg_ctl -D '$PGDATA' -l '$PGDATA/logfile' -o '-p $PGPORT' start"

echo "Waiting for PostgreSQL to be ready..."
until pg_isready -h localhost -p $PGPORT; do
  echo "Waiting for postgres..."
  sleep 1
done

# Create User and Database
# Determine if we need to connect as postgres user
DB_CONNECT_OPTS=""
if [ "$(id -u)" = "0" ]; then
    # If running as root, 'psql' usually tries to connect as 'root' or current user.
    # We want to connect as 'postgres' superuser (created by initdb running as postgres).
    DB_CONNECT_OPTS="-U postgres"
fi

# Check if 'admin' role exists
if ! psql -h localhost -p $PGPORT $DB_CONNECT_OPTS -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='$PGUSER'" | grep -q 1; then
    echo "Creating user $PGUSER..."
    psql -h localhost -p $PGPORT $DB_CONNECT_OPTS -d postgres -c "CREATE USER $PGUSER WITH SUPERUSER PASSWORD '$PGPASSWORD';"
fi

# Check if database exists
if ! psql -h localhost -p $PGPORT $DB_CONNECT_OPTS -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$PGDATABASE'" | grep -q 1; then
    echo "Creating database $PGDATABASE..."
    psql -h localhost -p $PGPORT $DB_CONNECT_OPTS -d postgres -c "CREATE DATABASE $PGDATABASE OWNER $PGUSER;"
fi

echo "Applying schema..."
psql -h localhost -p $PGPORT -U $PGUSER -d $PGDATABASE -f db/schema.sql

# Start Backend
echo "Starting Backend..."
cd backend
npm run start
