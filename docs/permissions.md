# ClickHouse Permissions Guide

This guide outlines the specific ClickHouse permissions required for different features of CHewie, following the principle of least privilege.

> **Important Note:** As mentioned in [Issue #69](https://github.com/caioricciuti/ch-ui/issues/69), CHewie currently requires admin privileges for user management features.

## Basic Usage (Read-Only)

For users who only need to view data and run SELECT queries:

```sql
-- Create a read-only user
CREATE USER 'chewie_readonly' IDENTIFIED BY 'your_password';

-- Grant minimal permissions
GRANT SELECT ON *.* TO chewie_readonly;
GRANT SHOW DATABASES ON *.* TO chewie_readonly;
GRANT SHOW TABLES ON *.* TO chewie_readonly;
GRANT SHOW COLUMNS ON *.* TO chewie_readonly;
```

### What this allows:
- Browse databases and tables
- View table schemas
- Run SELECT queries
- View query history
- Use the SQL editor

### What this prevents:
- Creating or dropping tables/databases
- Modifying data (INSERT, UPDATE, DELETE)
- Managing users
- Accessing system logs

## Standard User Permissions

For users who need to query and modify data:

```sql
-- Create a standard user
CREATE USER 'chewie_user' IDENTIFIED BY 'your_password';

-- Grant data manipulation permissions
GRANT SELECT, INSERT, ALTER, CREATE TABLE, DROP TABLE ON database_name.* TO chewie_user;
GRANT SHOW DATABASES ON *.* TO chewie_user;
GRANT SHOW TABLES ON *.* TO chewie_user;
GRANT SHOW COLUMNS ON *.* TO chewie_user;
```

### What this allows:
- Everything from read-only access
- Create and drop tables (in specified database)
- Insert and modify data
- Run DDL queries

### What this prevents:
- Creating new databases
- Managing users
- Accessing system tables
- Viewing system logs

## Admin Features

For full CHewie functionality including user management:

```sql
-- Create an admin user
CREATE USER 'chewie_admin' IDENTIFIED BY 'your_password';

-- Grant full permissions
GRANT ALL ON *.* TO chewie_admin WITH GRANT OPTION;
```

> **Admin Required:** Currently, the following CHewie features require ClickHouse admin privileges:
> - User management (create, modify, delete users)
> - Access to system logs
> - Managing saved queries (if enabled)
> - Full metrics dashboard access

### What this allows:
- All standard user permissions
- Create and manage users
- Access system tables and logs
- View all metrics
- Manage database-level settings

## System Tables Access

For users who need to monitor performance without full admin rights:

```sql
-- Create a monitoring user
CREATE USER 'chewie_monitor' IDENTIFIED BY 'your_password';

-- Grant read access to system tables
GRANT SELECT ON system.* TO chewie_monitor;
GRANT SELECT ON *.* TO chewie_monitor;
GRANT SHOW DATABASES ON *.* TO chewie_monitor;
GRANT SHOW TABLES ON *.* TO chewie_monitor;
```

### What this allows:
- View query logs
- Monitor performance metrics
- Access system statistics
- View all databases and tables

### What this prevents:
- Modifying any data
- Managing users
- Changing settings

## Saved Queries Feature

If you want to use CHewie's saved queries feature:

```sql
-- The user needs permission to create the chewie database and tables
GRANT CREATE DATABASE ON *.* TO chewie_user;
GRANT CREATE TABLE ON chewie.* TO chewie_user;
GRANT SELECT, INSERT, ALTER, DELETE ON chewie.* TO chewie_user;
```

The saved queries feature will create:
- Database: `chewie`
- Table: `chewie.saved_queries`

## Best Practices

### 1. Use Role-Based Access Control

Create roles for different access levels:

```sql
-- Create roles
CREATE ROLE chewie_readonly_role;
CREATE ROLE chewie_standard_role;
CREATE ROLE chewie_admin_role;

-- Grant permissions to roles
GRANT SELECT, SHOW ON *.* TO chewie_readonly_role;
GRANT SELECT, INSERT, ALTER, CREATE TABLE, DROP TABLE ON *.* TO chewie_standard_role;
GRANT ALL ON *.* TO chewie_admin_role WITH GRANT OPTION;

-- Assign roles to users
GRANT chewie_readonly_role TO john_doe;
GRANT chewie_standard_role TO jane_smith;
GRANT chewie_admin_role TO admin_user;
```

### 2. Limit Database Access

Restrict users to specific databases:

```sql
-- Create user with access to specific database only
CREATE USER 'analytics_user' IDENTIFIED BY 'password';
GRANT SELECT ON analytics.* TO analytics_user;
GRANT SHOW DATABASES ON analytics.* TO analytics_user;
```

### 3. Set Resource Limits

Prevent resource exhaustion:

```sql
-- Create user with resource limits
CREATE USER 'limited_user' IDENTIFIED BY 'password'
SETTINGS 
    max_memory_usage = 10000000000,  -- 10GB
    max_execution_time = 300,         -- 5 minutes
    max_rows_to_read = 1000000000,    -- 1 billion rows
    readonly = 0;
```

### 4. Regular Auditing

Monitor user activity:

```sql
-- Check user permissions
SHOW GRANTS FOR chewie_user;

-- View recent queries by user
SELECT 
    user,
    query,
    event_time,
    query_duration_ms,
    read_rows,
    memory_usage
FROM system.query_log
WHERE user = 'chewie_user'
  AND event_time > now() - INTERVAL 1 DAY
ORDER BY event_time DESC
LIMIT 100;
```

## Connection Security

### Using SSL/TLS

Configure secure connections in CHewie:

```bash
docker run --name chewie -p 5521:5521 \
  -e VITE_CLICKHOUSE_URL=https://your-clickhouse:8443 \
  -e VITE_CLICKHOUSE_USER=secure_user \
  -e VITE_CLICKHOUSE_PASS=secure_password \
  ghcr.io/kolsys/chewie:latest
```

### IP Restrictions

Limit access by IP in ClickHouse:

```xml
<!-- users.xml -->
<users>
    <chewie_user>
        <password>password</password>
        <networks>
            <ip>192.168.1.0/24</ip>
            <ip>10.0.0.0/8</ip>
        </networks>
    </chewie_user>
</users>
```

## Troubleshooting Permission Issues

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "Not enough privileges" | Missing required grant | Check and add missing permissions |
| "Database doesn't exist" | No access to database | Grant SHOW DATABASES permission |
| "Access denied" | Wrong credentials or IP restriction | Verify username/password and network access |
| "Cannot create table" | Missing CREATE permission | Grant CREATE TABLE on specific database |

### Verify User Permissions

```sql
-- Check current user
SELECT currentUser();

-- Show all permissions for current user
SHOW GRANTS;

-- Check specific permission
SELECT has_database_access(currentDatabase());
```

## Future Improvements

We're working on:
- Native CHewie authentication system
- More granular permission controls
- Role management interface
- Permission templates

Track progress in [GitHub Issues](https://github.com/kolsys/chewie/issues).

## Questions?

If you have questions about permissions or security:
- Open a [GitHub Discussion](https://github.com/kolsys/chewie/discussions)
- Report security issues privately to the maintainers
- Check existing [Issues](https://github.com/kolsys/chewie/issues) for similar questions