# SQLite Migration Guide

This document describes the migration from PostgreSQL to SQLite for the BottleMessenger application.

## Changes Made

1. **Database Engine**: Changed from PostgreSQL to SQLite
2. **Database Location**: SQLite database file is stored at `/app/data/bottlemessenger.db` inside the container
3. **Data Persistence**: The database file is persisted using a Docker volume named `sqlite-data`

## Configuration

The SQLite database path can be configured using the `SQLITE_DB_PATH` environment variable. This should point to a directory where the database file will be stored. The default is `/app/data`.

## Accessing the Database

### From Inside the Container

The SQLite database file is located at `/app/data/bottlemessenger.db` inside the container. You can access it using the SQLite command line tool:

```bash
docker exec -it bottlemessenger_app_1 sh
sqlite3 /app/data/bottlemessenger.db
```

### From Outside the Container

The database file is stored in a Docker volume named `sqlite-data`. You can find the location of this volume on your host machine using:

```bash
docker volume inspect sqlite-data
```

This will show you the `Mountpoint` where the volume is stored on your host machine. You can then access the database file directly using any SQLite client.

## Backup and Restore

### Backup

To backup the database, you can copy the database file from the container:

```bash
docker cp bottlemessenger_app_1:/app/data/bottlemessenger.db ./bottlemessenger_backup.db
```

### Restore

To restore from a backup, copy the database file back to the container:

```bash
docker cp ./bottlemessenger_backup.db bottlemessenger_app_1:/app/data/bottlemessenger.db
```

## Troubleshooting

If you encounter any issues with the database:

1. Check that the `/app/data` directory exists and is writable inside the container
2. Verify that the `sqlite-data` volume is properly mounted
3. Check the application logs for any database-related errors:

```bash
docker logs bottlemessenger_app_1
