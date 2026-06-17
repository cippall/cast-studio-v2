#!/usr/bin/env bash
# db-setup.sh — Set up PostgreSQL for development
# Run: sudo bash server/scripts/db-setup.sh
set -euo pipefail

echo "=== Cast Studio v2 — Database Setup ==="

# Install PostgreSQL if not present
if ! command -v psql &>/dev/null; then
  echo "Installing PostgreSQL..."
  apt-get update -qq
  apt-get install -y -qq postgresql postgresql-contrib
fi

# Start PostgreSQL if not running
if ! pg_isready -q 2>/dev/null; then
  echo "Starting PostgreSQL..."
  pg_ctlcluster "$(pg_lsclusters -h | head -1 | awk '{print $1 " " $2}')" start
fi

# Create the database user and database
DB_NAME="${PGDATABASE:-cast_studio_dev}"
DB_USER="${PGUSER:-cast_studio}"

echo "Creating database user $DB_USER..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD 'cast_studio_dev_pwd';"

echo "Creating database $DB_NAME..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

echo "Granting permissions..."
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

echo ""
echo "=== Database Setup Complete ==="
echo "Database: $DB_NAME"
echo "User:     $DB_USER"
echo ""
echo "Update server/.env with:"
echo "  DATABASE_URL=postgres://$DB_USER:cast_studio_dev_pwd@localhost:5432/$DB_NAME"
echo ""
echo "Then run:"
echo "  cd server && npm run migrate:up"
