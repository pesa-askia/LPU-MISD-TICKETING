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
      // Table doesn't exist, create it
      await supabase.rpc("execute_sql", {
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
    }

    // Migrate: add user_type and department to auth_users
    try {
      await supabase.rpc("execute_sql", {
        sql: `
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'auth_users' AND column_name = 'user_type'
            ) THEN
              ALTER TABLE auth_users ADD COLUMN user_type VARCHAR(50);
            END IF;
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'auth_users' AND column_name = 'department'
            ) THEN
              ALTER TABLE auth_users ADD COLUMN department VARCHAR(100);
            END IF;
          END
          $$;
        `,
      });
      console.log("✓ auth_users");
    } catch (migrateErr) {
      console.warn("auth_users user_type/department migration skipped:", migrateErr.message);
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

            IF NOT EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_name = 'Tickets' AND column_name = 'satisfaction'
            ) THEN
              ALTER TABLE "Tickets" ADD COLUMN satisfaction BOOLEAN;
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
        console.log("✓ ticket-attachments (bucket created)");
      }
    } catch (storageErr) {
      console.warn(
        "Storage bucket initialization skipped:",
        storageErr.message,
      );
    }

    // Chatbot sessions table
    try {
      await supabase.rpc("execute_sql", {
        sql: `
          CREATE TABLE IF NOT EXISTS chatbot_sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            session_id TEXT NOT NULL UNIQUE,
            user_id UUID,
            status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'transferred')),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_session_id ON chatbot_sessions(session_id);
          CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_user_id ON chatbot_sessions(user_id);
        `,
      });
      console.log("✓ chatbot_sessions");
    } catch (chatbotInitError) {
      console.warn("chatbot_sessions init skipped:", chatbotInitError.message);
    }

    // Chatbot messages table (used by chatbotService logging)
    try {
      await supabase.rpc("execute_sql", {
        sql: `
          CREATE TABLE IF NOT EXISTS chatbot_messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            session_id TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
            content TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_chatbot_messages_session_id
            ON chatbot_messages(session_id, created_at);
        `,
      });
      console.log("✓ chatbot_messages");
    } catch (chatbotMsgsInitError) {
      console.warn("chatbot_messages init skipped:", chatbotMsgsInitError.message);
    }

    // Chatbot per-account limiter table
    try {
      await supabase.rpc("execute_sql", {
        sql: `
          CREATE TABLE IF NOT EXISTS chatbot_account_limits (
            key TEXT PRIMARY KEY,
            user_id UUID,
            chat_count INTEGER NOT NULL DEFAULT 0,
            cooldown_until TIMESTAMPTZ,
            window_start TIMESTAMPTZ,
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );

          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'chatbot_account_limits' AND column_name = 'window_start'
            ) THEN
              ALTER TABLE public.chatbot_account_limits
                ADD COLUMN window_start TIMESTAMPTZ;
            END IF;
          END
          $$;

          CREATE INDEX IF NOT EXISTS idx_chatbot_account_limits_user_id
            ON chatbot_account_limits(user_id);
        `,
      });
      console.log("✓ chatbot_account_limits");
    } catch (limiterInitError) {
      console.warn(
        "chatbot_account_limits init skipped:",
        limiterInitError.message,
      );
    }

    // Knowledge base table (RAG / chatbot)
    try {
      await supabase.rpc("execute_sql", {
        sql: `
          CREATE EXTENSION IF NOT EXISTS vector;

          CREATE TABLE IF NOT EXISTS knowledge_base (
            id BIGSERIAL PRIMARY KEY,
            content TEXT NOT NULL,
            metadata JSONB DEFAULT '{}'::jsonb,
            embedding vector(768),
            created_at TIMESTAMPTZ DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_knowledge_base_embedding
            ON knowledge_base USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 100);

          CREATE OR REPLACE FUNCTION search_knowledge_base(
            query_embedding vector(768),
            match_threshold FLOAT,
            match_count INT
          )
          RETURNS TABLE (
            id BIGINT,
            content TEXT,
            metadata JSONB,
            similarity FLOAT
          )
          LANGUAGE plpgsql
          AS $$
          BEGIN
            RETURN QUERY
            SELECT
              kb.id,
              kb.content,
              kb.metadata,
              1 - (kb.embedding <=> query_embedding) AS similarity
            FROM knowledge_base kb
            WHERE 1 - (kb.embedding <=> query_embedding) > match_threshold
            ORDER BY kb.embedding <=> query_embedding
            LIMIT match_count;
          END;
          $$;
        `,
      });
      console.log("✓ knowledge_base");
    } catch (knowledgeInitError) {
      console.warn("knowledge_base init skipped:", knowledgeInitError.message);
    }

    // Ticket SLA history table (timeline snapshots per ticket)
    try {
      await supabase.rpc("execute_sql", {
        sql: `
          CREATE TABLE IF NOT EXISTS ticket_sla_history (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            ticket_id INTEGER NOT NULL,
            status TEXT,
            opened_at TIMESTAMPTZ,
            closed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_ticket_sla_history_ticket_id
            ON ticket_sla_history(ticket_id, closed_at DESC);
        `,
      });
      console.log("✓ ticket_sla_history");
    } catch (slaInitError) {
      console.warn("ticket_sla_history init skipped:", slaInitError.message);
    }

    // activity_logs table
    try {
      await supabase.rpc("execute_sql", {
        sql: `
          CREATE TABLE IF NOT EXISTS activity_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            admin_id UUID NOT NULL,
            action_type VARCHAR(50) NOT NULL,
            target_type VARCHAR(50),
            target_id VARCHAR(100),
            target_label VARCHAR(255),
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_activity_logs_admin_id ON activity_logs(admin_id);
          CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
        `,
      });
      console.log("✓ activity_logs");
    } catch (activityInitError) {
      console.warn("activity_logs init skipped:", activityInitError.message);
    }

    // RLS policies for all tables
    // Backend uses service_role key which bypasses RLS entirely.
    // Policies here only govern frontend (anon key + user JWT).
    try {
      await supabase.rpc("execute_sql", {
        sql: `
          -- Tickets: users see own, admins see all; only admins can update
          ALTER TABLE "Tickets" ENABLE ROW LEVEL SECURITY;

          DO $$
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'Tickets' AND policyname = 'tickets_select') THEN
              CREATE POLICY tickets_select ON "Tickets" FOR SELECT USING (
                created_by = auth.uid() OR (auth.jwt() ->> 'app_role') = 'admin'
              );
            END IF;

            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'Tickets' AND policyname = 'tickets_insert') THEN
              CREATE POLICY tickets_insert ON "Tickets" FOR INSERT WITH CHECK (
                auth.uid() IS NOT NULL
              );
            END IF;

            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'Tickets' AND policyname = 'tickets_update') THEN
              CREATE POLICY tickets_update ON "Tickets" FOR UPDATE USING (
                (auth.jwt() ->> 'app_role') = 'admin'
              );
            END IF;
          END
          $$;

          -- auth_users: users see own row, admins see all; no frontend mutations
          ALTER TABLE auth_users ENABLE ROW LEVEL SECURITY;

          DO $$
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'auth_users' AND policyname = 'auth_users_select') THEN
              CREATE POLICY auth_users_select ON auth_users FOR SELECT USING (
                id = auth.uid() OR (auth.jwt() ->> 'app_role') = 'admin'
              );
            END IF;
          END
          $$;

          -- admin_users: admins see all; no frontend mutations
          ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

          DO $$
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_users' AND policyname = 'admin_users_select') THEN
              CREATE POLICY admin_users_select ON admin_users FOR SELECT USING (
                (auth.jwt() ->> 'app_role') = 'admin'
              );
            END IF;
          END
          $$;

          -- ticket_sla_history: users see own ticket history, admins see all; no frontend mutations
          ALTER TABLE ticket_sla_history ENABLE ROW LEVEL SECURITY;

          DO $$
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ticket_sla_history' AND policyname = 'ticket_sla_history_select') THEN
              CREATE POLICY ticket_sla_history_select ON ticket_sla_history FOR SELECT USING (
                (auth.jwt() ->> 'app_role') = 'admin'
                OR EXISTS (
                  SELECT 1 FROM "Tickets" t WHERE t.id = ticket_id AND t.created_by = auth.uid()
                )
              );
            END IF;
          END
          $$;

          -- Backend-only tables: enable RLS, no policies = anon/user blocked, service_role bypasses
          ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
          ALTER TABLE chatbot_sessions ENABLE ROW LEVEL SECURITY;
          ALTER TABLE chatbot_messages ENABLE ROW LEVEL SECURITY;
          ALTER TABLE chatbot_account_limits ENABLE ROW LEVEL SECURITY;
          ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
        `,
      });
      console.log("✓ RLS policies");
    } catch (rlsError) {
      console.warn("RLS policy setup skipped:", rlsError.message);
    }

    console.log("✓ Database ready");
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
    } catch {
      // non-critical, PostgREST will reload on next request
    }
  };

  try {
    // Check if table exists
    const { error: tableCheckError } = await supabase
      .from("admin_users")
      .select("id")
      .limit(1);

    if (isMissingTableError(tableCheckError)) {
      await supabase.rpc("execute_sql", {
        sql: `
          CREATE TABLE IF NOT EXISTS admin_users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            full_name VARCHAR(255),
            is_active BOOLEAN DEFAULT true,
            admin_level INTEGER NOT NULL DEFAULT 1 CHECK (admin_level IN (0, 1)),
            email_verified_at TIMESTAMPTZ,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );

          CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
        `,
      });

      await reloadSchemaCache();
    } else if (tableCheckError) {
      console.error("[Admin init] Table check error:", tableCheckError.message);
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
                CHECK (admin_level IN (0, 1));
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

    // Migrate: simplify admin levels — convert old levels 2 and 3 to Ticket Admin (1)
    try {
      await supabase.rpc("execute_sql", {
        sql: `
          DO $$
          BEGIN
            UPDATE admin_users SET admin_level = 1 WHERE admin_level IN (2, 3);
            BEGIN
              ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_admin_level_check;
              ALTER TABLE admin_users ADD CONSTRAINT admin_users_admin_level_check CHECK (admin_level IN (0, 1));
            EXCEPTION WHEN OTHERS THEN
              NULL;
            END;
          END
          $$;
        `,
      });
    } catch (migrateErr) {
      console.warn("admin_level simplification migration skipped:", migrateErr.message);
    }

    // Migrate: add supabase_auth_id to track the corresponding Supabase Auth user
    try {
      await supabase.rpc("execute_sql", {
        sql: `
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'admin_users' AND column_name = 'supabase_auth_id'
            ) THEN
              ALTER TABLE admin_users ADD COLUMN supabase_auth_id UUID;
            END IF;
          END
          $$;
        `,
      });
    } catch (migrateErr) {
      console.warn("supabase_auth_id migration skipped:", migrateErr.message);
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
      console.error("[Admin init] Seed lookup error:", findError.message);
      return;
    }

    if (existing && existing.length > 0) {
      console.log(`✓ admin_users (seed: ${seedEmail})`);
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
      console.error("[Admin init] Seed insert failed:", insertError.message);
      return;
    }

    console.log(`✓ admin_users (seed created: ${seedEmail})`);
  } catch (error) {
    console.error("Admin initialization error:", error.message);
  }
};
