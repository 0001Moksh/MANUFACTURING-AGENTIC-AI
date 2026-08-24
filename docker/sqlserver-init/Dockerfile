FROM mcr.microsoft.com/mssql-tools18:latest
COPY docker/scripts/init-sqlserver.sh /usr/local/bin/init-sqlserver.sh
COPY docs/mes_db_info/mes_new.bak /backups/mes_new.bak
COPY docs/mes_db_info/schema.sql /backups/schema.sql
RUN chmod 0555 /usr/local/bin/init-sqlserver.sh
