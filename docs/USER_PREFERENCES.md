# User Preferences

## Automatic SQL Execution
**Request:** The user wants the AI to automatically execute SQL commands (migrations, schema changes) in Supabase whenever necessary, without asking for manual execution.

**Status:** ⚠️ **Blocked by Missing Credentials**

**Requirement:**
To enable this feature, the project's `.env` file must contain one of the following:
1.  `SUPABASE_SERVICE_ROLE_KEY`: Allows bypassing Row Level Security and executing administrative tasks via the API (if supported by project setup).
2.  `DATABASE_URL`: A direct PostgreSQL connection string (e.g., `postgresql://postgres:[password]@db.supabase.co:5432/[db]`). This allows running raw SQL scripts using a Node.js client.

**Current State:**
The `.env` file currently only contains `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The `ANON_KEY` is restricted and cannot perform schema changes (DDL).

**Action Item:**
If the user provides these credentials in the future, the AI should prioritize implementing a script (e.g., in `scripts/run_sql.js`) to execute migrations automatically.
