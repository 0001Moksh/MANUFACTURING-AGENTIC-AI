FROM postgres:17
COPY docker/scripts/init-postgres.sh /usr/local/bin/init-postgres.sh
COPY docs/mai_db_info/manufacturing_ai.sql /backups/manufacturing_ai.sql
COPY docs/video_analytics_db_info/construction_ai_backup.sql /backups/construction_ai_backup.sql
RUN chmod 0555 /usr/local/bin/init-postgres.sh
