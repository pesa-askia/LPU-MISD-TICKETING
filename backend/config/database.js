import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
// Prefer a server-side service role key when available (required for inserts/updates
// when Row Level Security is enabled). Fall back to the anon key if not set.
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase URL or key in environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Setup auth table in Supabase if it doesn't exist
 * This function is called on server startup
 */
export const initializeDatabase = async () => {
  try {
    const kind = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? "service_role"
      : "anon";
    const origin = (() => {
      try {
        return new URL(supabaseUrl).origin;
      } catch {
        return supabaseUrl;
      }
    })();
    console.log(`[DB] Using Supabase (${kind}) at ${origin}`);

    // Check if auth_users table exists by trying to select from it
    const { data, error } = await supabase
      .from("auth_users")
      .select("id")
      .limit(1);

    if (error && error.code === "PGRST116") {
      console.log("Creating auth_users table...");
      // Table doesn't exist, create it
      const { error: createError } = await supabase.rpc("execute_sql", {
        sql: `
                    CREATE TABLE IF NOT EXISTS auth_users (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        email VARCHAR(255) NOT NULL UNIQUE,
                        password_hash VARCHAR(255) NOT NULL,
                        full_name VARCHAR(255),
                        is_active BOOLEAN DEFAULT true,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );

                    CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);
                `,
      });

      if (createError) {
        console.log(
          "Table might already exist or RPC not available. Continuing...",
        );
      }
    }

    // Ensure ticket-related tables/columns exist
    try {
      await supabase.rpc("execute_sql", {
        sql: `
          -- Ticket messages table for chat
          CREATE TABLE IF NOT EXISTS ticket_messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            ticket_id INTEGER NOT NULL,
            sender_id UUID NOT NULL,
            sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'admin')),
            sender_name TEXT,
            sender_email TEXT,
            attachments TEXT,
            message_text TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id
            ON ticket_messages(ticket_id, created_at);

          ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;

          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_policies
              WHERE schemaname = 'public'
                AND tablename = 'ticket_messages'
                AND policyname = 'ticket_messages_select'
            ) THEN
              CREATE POLICY ticket_messages_select
                ON ticket_messages
                FOR SELECT
                USING (
                  (auth.jwt() ->> 'app_role') = 'admin'
                  OR EXISTS (
                    SELECT 1
                    FROM "Tickets" t
                    WHERE t.id = ticket_messages.ticket_id
                      AND t.created_by = auth.uid()
                  )
                );
            END IF;

            IF NOT EXISTS (
              SELECT 1 FROM pg_policies
              WHERE schemaname = 'public'
                AND tablename = 'ticket_messages'
                AND policyname = 'ticket_messages_insert'
            ) THEN
              CREATE POLICY ticket_messages_insert
                ON ticket_messages
                FOR INSERT
                WITH CHECK (
                  sender_id = auth.uid()
                  AND (
                    (auth.jwt() ->> 'app_role') = 'admin'
                    OR EXISTS (
                      SELECT 1
                      FROM "Tickets" t
                      WHERE t.id = ticket_messages.ticket_id
                        AND t.created_by = auth.uid()
                    )
                  )
                );
            END IF;
          END
          $$;

          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_name = 'ticket_messages' AND column_name = 'sender_name'
            ) THEN
              ALTER TABLE ticket_messages ADD COLUMN sender_name TEXT;
            END IF;

            IF NOT EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_name = 'ticket_messages' AND column_name = 'sender_email'
            ) THEN
              ALTER TABLE ticket_messages ADD COLUMN sender_email TEXT;
            END IF;

            IF NOT EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_name = 'ticket_messages' AND column_name = 'attachments'
            ) THEN
              ALTER TABLE ticket_messages ADD COLUMN attachments TEXT;
            END IF;
          END
          $$;

          -- Optional assignee columns on Tickets table (no-op if they already exist)
          DO $$
          BEGIN
            -- Ensure Tickets table exists. If not, create with typical fields used by UI.
            IF NOT EXISTS (
              SELECT 1
              FROM information_schema.tables
              WHERE table_name = 'Tickets' AND table_schema = 'public'
            ) THEN
              CREATE TABLE "Tickets" (
                id SERIAL PRIMARY KEY,
                Summary TEXT,
                Description TEXT,
                Type TEXT,
                Department TEXT,
                Category TEXT,
                Site TEXT,
                created_by UUID,
                created_by_name TEXT,
                created_by_email TEXT,
                status TEXT DEFAULT 'Open',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                closed_at TIMESTAMPTZ
              );
            END IF;

            IF NOT EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_name = 'Tickets' AND column_name = 'created_by_name'
            ) THEN
              ALTER TABLE "Tickets" ADD COLUMN created_by_name TEXT;
            END IF;

            IF NOT EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_name = 'Tickets' AND column_name = 'created_by_email'
            ) THEN
              ALTER TABLE "Tickets" ADD COLUMN created_by_email TEXT;
            END IF;

            IF NOT EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_name = 'Tickets' AND column_name = 'Assignee1'
            ) THEN
              ALTER TABLE "Tickets" ADD COLUMN "Assignee1" TEXT;
            END IF;

            IF NOT EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_name = 'Tickets' AND column_name = 'Assignee2'
            ) THEN
              ALTER TABLE "Tickets" ADD COLUMN "Assignee2" TEXT;
            END IF;

            IF NOT EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_name = 'Tickets' AND column_name = 'Assignee3'
            ) THEN
              ALTER TABLE "Tickets" ADD COLUMN "Assignee3" TEXT;
            END IF;

            IF NOT EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_name = 'Tickets' AND column_name = 'created_at'
            ) THEN
              ALTER TABLE "Tickets" ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
            END IF;

            IF NOT EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_name = 'Tickets' AND column_name = 'closed_at'
            ) THEN
              ALTER TABLE "Tickets" ADD COLUMN closed_at TIMESTAMPTZ;
            END IF;

            IF NOT EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_name = 'Tickets' AND column_name = 'status'
            ) THEN
              ALTER TABLE "Tickets" ADD COLUMN status TEXT DEFAULT 'Open';
            END IF;
          END
          $$;
        `,
      });
    } catch (ticketInitError) {
      console.warn(
        "Ticketing tables/columns initialization skipped:",
        ticketInitError.message,
      );
    }

    // Ensure the ticket-attachments Storage bucket exists
    try {
      const { data: buckets, error: listErr } =
        await supabase.storage.listBuckets();
      if (listErr) throw listErr;
      const exists = buckets?.some((b) => b.name === "ticket-attachments");
      if (!exists) {
        const { error: createErr } = await supabase.storage.createBucket(
          "ticket-attachments",
          {
            public: true,
          },
        );
        if (createErr) throw createErr;
        console.log("✓ Created storage bucket: ticket-attachments");
      } else {
        console.log("✓ Storage bucket already exists: ticket-attachments");
      }
    } catch (storageErr) {
      console.warn(
        "Storage bucket initialization skipped:",
        storageErr.message,
      );
    }

    console.log("✓ Database initialized");
  } catch (error) {
    console.error("Database initialization error:", error.message);
  }
};

/**
 * Create admin_users table + seed a mock admin (optional)
 */
export const initializeAdminUsers = async () => {
  const seedEmail = process.env.ADMIN_SEED_EMAIL;
  const seedPassword = process.env.ADMIN_SEED_PASSWORD;
  const seedFullName = process.env.ADMIN_SEED_FULL_NAME || "System Admin";

  const isMissingTableError = (err) => {
    if (!err) return false;
    if (err.code === "PGRST116") return true;
    const msg = (err.message || "").toLowerCase();
    return (
      msg.includes("schema cache") || msg.includes("could not find the table")
    );
  };

  const reloadSchemaCache = async () => {
    try {
      await supabase.rpc("execute_sql", {
        sql: "NOTIFY pgrst, 'reload schema';",
      });
    } catch (err) {
      console.log("Schema cache reload skipped:", err.message);
    }
  };

  try {
    // Check if table exists
    const { error: tableCheckError } = await supabase
      .from("admin_users")
      .select("id")
      .limit(1);

    if (isMissingTableError(tableCheckError)) {
      console.log("Creating admin_users table...");
      const { error: createError } = await supabase.rpc("execute_sql", {
        sql: `
          CREATE TABLE IF NOT EXISTS admin_users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            full_name VARCHAR(255),
            is_active BOOLEAN DEFAULT true,
            admin_level INTEGER NOT NULL DEFAULT 1 CHECK (admin_level IN (0, 1, 2, 3)),
            email_verified_at TIMESTAMPTZ,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );

          CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
        `,
      });

      if (createError) {
        console.log(
          "admin_users table might already exist or execute_sql RPC not available. Continuing...",
        );
      }

      await reloadSchemaCache();
    } else if (tableCheckError) {
      console.log("Admin table check error:", tableCheckError.message);
      return;
    }

    // Migrate: add admin_level column if it doesn't exist
    try {
      await supabase.rpc("execute_sql", {
        sql: `
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_name = 'admin_users' AND column_name = 'admin_level'
            ) THEN
              ALTER TABLE admin_users
                ADD COLUMN admin_level INTEGER NOT NULL DEFAULT 1
                CHECK (admin_level IN (0, 1, 2, 3));
            END IF;

            ALTER TABLE admin_users
              ALTER COLUMN admin_level SET DEFAULT 1;
          END
          $$;
        `,
      });
    } catch (migrateErr) {
      console.warn("admin_level migration skipped:", migrateErr.message);
    }

    // New admins invited by root must verify email; existing rows are backfilled once when
    // this column is first added (same migration block — not on every startup).
    try {
      await supabase.rpc("execute_sql", {
        sql: `
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'admin_users' AND column_name = 'email_verified_at'
            ) THEN
              ALTER TABLE admin_users ADD COLUMN email_verified_at TIMESTAMPTZ;
              UPDATE admin_users
                SET email_verified_at = COALESCE(created_at, NOW())
                WHERE email_verified_at IS NULL;
            END IF;
          END
          $$;
        `,
      });
    } catch (migrateErr) {
      console.warn("email_verified_at migration skipped:", migrateErr.message);
    }

    // Seed mock admin (only if env vars provided)
    if (!seedEmail || !seedPassword) {
      console.log(
        "Skipping admin seed (set ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD to create a mock admin).",
      );
      return;
    }

    let existing = null;
    let findError = null;

    ({ data: existing, error: findError } = await supabase
      .from("admin_users")
      .select("id")
      .eq("email", seedEmail));

    if (isMissingTableError(findError)) {
      await reloadSchemaCache();
      ({ data: existing, error: findError } = await supabase
        .from("admin_users")
        .select("id")
        .eq("email", seedEmail));
    }

    if (findError) {
      console.log("Admin seed lookup error:", findError.message);
      return;
    }

    if (existing && existing.length > 0) {
      console.log("✓ Mock admin already exists");
      return;
    }

    const passwordHash = await bcrypt.hash(seedPassword, 10);

    const { error: insertError } = await supabase.from("admin_users").insert([
      {
        email: seedEmail,
        password_hash: passwordHash,
        full_name: seedFullName,
        is_active: true,
        admin_level: 0,
        email_verified_at: new Date().toISOString(),
      },
    ]);

    if (insertError) {
      console.log("Mock admin seed insert failed:", insertError.message);
      return;
    }

    console.log(`✓ Mock admin created (${seedEmail})`);
  } catch (error) {
    console.error("Admin initialization error:", error.message);
  }
};
