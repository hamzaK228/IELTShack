# Backup and recovery

Supabase PITR is **not enabled** on the current free-plan project (`supabase backups list` reports `PITR false`). Do not rely on platform backups.

The app-data dump is limited to `public.ielts_*` tables, so SAThack data and `auth.users` secrets are not copied.

```bash
export SUPABASE_DB_URL='postgresql://postgres.<ref>:<password>@<host>:5432/postgres'
./scripts/backup-ielts.sh
```

Store the output encrypted outside the repository and test a restore into a separate project before trusting it. A daily cron job on a trusted machine is better than a laptop-only backup.

Schema/RLS is reproducible from `supabase/migrations/`; the data dump covers user rows.
