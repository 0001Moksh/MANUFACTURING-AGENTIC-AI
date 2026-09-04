FROM mcr.microsoft.com/mssql/server:2022-latest

USER root

RUN apt-get update \
    && apt-get install -y curl gnupg2 apt-transport-https ca-certificates \
    && curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add - \
    && curl https://packages.microsoft.com/config/ubuntu/22.04/prod.list \
       > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y msodbcsql18 mssql-tools18 \
    && rm -rf /var/lib/apt/lists/*

COPY docker/scripts/init-sqlserver.sh /usr/local/bin/init-sqlserver.sh
COPY docs/mes_db_info/mes_new.bak /backups/mes_new.bak
COPY docs/mes_db_info/schema.sql /backups/schema.sql

RUN chmod 0555 /usr/local/bin/init-sqlserver.sh
