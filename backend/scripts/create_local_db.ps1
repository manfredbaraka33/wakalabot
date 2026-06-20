# PowerShell script to create local Postgres user and database for Wakalabot
# Run this as a user with permission to run `psql` as the Postgres superuser.
# Usage: Open PowerShell as Administrator (or a user with psql access) and run:
#   .\scripts\create_local_db.ps1

$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
    Write-Error "psql not found in PATH. Install PostgreSQL client or add psql to PATH."
    exit 1
}

$pg_super_user = "postgres"
$target_user = "user"
$target_pass = "1234"
$db_name = "wakalabot"

Write-Host "Creating user $target_user with password and database $db_name..."

& psql -U $pg_super_user -c "CREATE USER \"$target_user\" WITH PASSWORD '$target_pass';" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "User may already exist or there was an error; attempting to continue..."
}

& psql -U $pg_super_user -c "CREATE DATABASE \"$db_name\" OWNER \"$target_user\";" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Database may already exist or there was an error; attempting to continue..."
}

Write-Host "Granting privileges..."
& psql -U $pg_super_user -c "GRANT ALL PRIVILEGES ON DATABASE \"$db_name\" TO \"$target_user\";"

Write-Host "Enabling 'vector' extension in database $db_name (pgvector)..."
& psql -U $pg_super_user -d $db_name -c "CREATE EXTENSION IF NOT EXISTS vector;"

Write-Host "Done. You can now restart the app: uvicorn app.main:app --reload"
