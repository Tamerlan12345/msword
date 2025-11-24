# Database Setup

## Prerequisites
- Docker and Docker Compose installed on your machine.

## Running Local Database
To start the PostgreSQL database and Adminer interface, run:

```bash
docker-compose up -d
```

This will start:
- **PostgreSQL 15** on port `5432`
  - User: `admin`
  - Password: `password`
  - Database: `cic_docflow`
- **Adminer** (Web GUI) on port `8080` (http://localhost:8080)

## Schema
The database schema is defined in `db/schema.sql` and will be automatically applied when the database container starts for the first time.

## Parallel Approval Logic
The schema supports parallel approvals:
1. `workflow_steps` has `approval_type` ('any' or 'all').
2. `workflow_step_approvers` defines who (users or roles) can approve.
3. `instance_approvals` tracks individual votes for a running process.
