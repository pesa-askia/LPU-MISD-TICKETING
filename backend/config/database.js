/* global process */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase URL or key in environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseKey);

const sql = async (query) => {
  const { error } = await supabase.rpc("execute_sql", { sql: query });
  if (error) throw error;
};

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

    // Verify execute_sql exists — created by backend/schema.sql
    const { error: rpcCheck } = await supabase.rpc("execute_sql", {
      sql: "SELECT 1",
    });
    if (rpcCheck) {
      console.error(`
╔══════════════════════════════════════════════════════════════╗
║  DATABASE SETUP REQUIRED                                     ║
║                                                              ║
║  The 'execute_sql' function is missing from your Supabase    ║
║  project. Run the one-time setup script first:               ║
║                                                              ║
║  1. Open https://app.supabase.com/project/_/sql              ║
║  2. Paste and run the contents of backend/schema.sql         ║
║  3. Restart the backend                                       ║
╚══════════════════════════════════════════════════════════════╝
      `);
      return;
    }

    // ── auth_users ────────────────────────────────────────────
    await sql(`
      CREATE TABLE IF NOT EXISTS auth_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255),
        user_type VARCHAR(50),
        department VARCHAR(100),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);
      ALTER TABLE auth_users ENABLE ROW LEVEL SECURITY;
    `);
    console.log("✓ auth_users");

    // ── admin_users ───────────────────────────────────────────
    await sql(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        admin_level INTEGER NOT NULL DEFAULT 1 CHECK (admin_level IN (0, 1)),
        supabase_auth_id UUID,
        email_verified_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
      ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
    `);
    console.log("✓ admin_users");

    // ── Tickets ───────────────────────────────────────────────
    await sql(`
      CREATE TABLE IF NOT EXISTS "Tickets" (
        id SERIAL PRIMARY KEY,
        "Summary" TEXT,
        "Description" TEXT,
        "Type" TEXT,
        "Department" TEXT,
        "Category" TEXT,
        "Site" TEXT,
        "Assignee1" TEXT,
        "Assignee2" TEXT,
        "Assignee3" TEXT,
        "Priority" TEXT,
        created_by UUID,
        created_by_name TEXT,
        created_by_email TEXT,
        status TEXT DEFAULT 'Open',
        satisfaction BOOLEAN,
        satisfaction_comment TEXT,
        timer_duration_seconds INTEGER,
        sla_met BOOLEAN,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        closed_at TIMESTAMPTZ
      );
      ALTER TABLE "Tickets" ENABLE ROW LEVEL SECURITY;
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_publication_tables
          WHERE pubname = 'supabase_realtime' AND tablename = 'Tickets'
        ) THEN
          ALTER PUBLICATION supabase_realtime ADD TABLE "Tickets";
        END IF;
      END $$;
    `);
    console.log("✓ Tickets");

    // ── ticket_messages ───────────────────────────────────────
    await sql(`
      CREATE TABLE IF NOT EXISTS ticket_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id INTEGER NOT NULL,
        sender_id UUID NOT NULL,
        sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'admin')),
        sender_name TEXT,
        sender_email TEXT,
        attachments TEXT,
        message_text TEXT NOT NULL,
        ticket_owner_id UUID,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id
        ON ticket_messages(ticket_id, created_at);
      ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_publication_tables
          WHERE pubname = 'supabase_realtime' AND tablename = 'ticket_messages'
        ) THEN
          ALTER PUBLICATION supabase_realtime ADD TABLE ticket_messages;
        END IF;
      END $$;
    `);
    console.log("✓ ticket_messages");

    // ── ticket_sla_history ────────────────────────────────────
    await sql(`
      CREATE TABLE IF NOT EXISTS ticket_sla_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id INTEGER NOT NULL,
        status TEXT,
        priority TEXT,
        timer_started_at TIMESTAMPTZ,
        sla_due_at TIMESTAMPTZ,
        sla_minutes INTEGER,
        timer_stopped_at TIMESTAMPTZ,
        timer_duration_seconds INTEGER,
        sla_met BOOLEAN,
        opened_at TIMESTAMPTZ,
        closed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_ticket_sla_history_ticket_id
        ON ticket_sla_history(ticket_id, closed_at DESC);
      ALTER TABLE ticket_sla_history ENABLE ROW LEVEL SECURITY;
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_publication_tables
          WHERE pubname = 'supabase_realtime' AND tablename = 'ticket_sla_history'
        ) THEN
          ALTER PUBLICATION supabase_realtime ADD TABLE ticket_sla_history;
        END IF;
      END $$;
    `);
    console.log("✓ ticket_sla_history");

    // ── SLA trigger ───────────────────────────────────────────
    await sql(`
      CREATE OR REPLACE FUNCTION fn_sla_start_on_first_admin_message()
      RETURNS TRIGGER AS $$
      DECLARE
        v_priority TEXT;
        v_sla_minutes INTEGER;
      BEGIN
        IF NEW.sender_role = 'admin' THEN
          IF NOT EXISTS (
            SELECT 1 FROM ticket_sla_history
            WHERE ticket_id = NEW.ticket_id AND timer_stopped_at IS NULL
          ) THEN
            SELECT "Priority" INTO v_priority FROM "Tickets" WHERE id = NEW.ticket_id;
            v_sla_minutes := CASE COALESCE(v_priority, 'Low')
              WHEN 'High'   THEN 30
              WHEN 'Medium' THEN 45
              ELSE 60
            END;
            INSERT INTO ticket_sla_history (
              ticket_id, status, priority,
              timer_started_at, sla_due_at, sla_minutes, opened_at
            ) VALUES (
              NEW.ticket_id, 'Open', v_priority,
              NEW.created_at,
              NEW.created_at + (v_sla_minutes * INTERVAL '1 minute'),
              v_sla_minutes,
              NEW.created_at
            );
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;

      DROP TRIGGER IF EXISTS trg_sla_start ON ticket_messages;
      CREATE TRIGGER trg_sla_start
        AFTER INSERT ON ticket_messages
        FOR EACH ROW EXECUTE FUNCTION fn_sla_start_on_first_admin_message();
    `);
    console.log("✓ SLA trigger");

    // ── activity_logs ─────────────────────────────────────────
    await sql(`
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
      ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
    `);
    console.log("✓ activity_logs");

    // ── chatbot tables ────────────────────────────────────────
    await sql(`
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
      ALTER TABLE chatbot_sessions ENABLE ROW LEVEL SECURITY;

      CREATE TABLE IF NOT EXISTS chatbot_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_chatbot_messages_session_id
        ON chatbot_messages(session_id, created_at);
      ALTER TABLE chatbot_messages ENABLE ROW LEVEL SECURITY;

      CREATE TABLE IF NOT EXISTS chatbot_account_limits (
        key TEXT PRIMARY KEY,
        user_id UUID,
        chat_count INTEGER NOT NULL DEFAULT 0,
        cooldown_until TIMESTAMPTZ,
        window_start TIMESTAMPTZ,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_chatbot_account_limits_user_id
        ON chatbot_account_limits(user_id);
      ALTER TABLE chatbot_account_limits ENABLE ROW LEVEL SECURITY;
    `);
    console.log(
      "✓ chatbot_sessions / chatbot_messages / chatbot_account_limits",
    );

    // ── knowledge_base ────────────────────────────────────────
    await sql(`
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
      ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

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
    `);
    console.log("✓ knowledge_base");

    // ── Storage bucket ────────────────────────────────────────
    try {
      const { data: buckets, error: listErr } =
        await supabase.storage.listBuckets();
      if (listErr) throw listErr;
      if (!buckets?.some((b) => b.name === "ticket-attachments")) {
        const { error: createErr } = await supabase.storage.createBucket(
          "ticket-attachments",
          { public: true },
        );
        if (createErr) throw createErr;
        console.log("✓ ticket-attachments (bucket created)");
      }
    } catch (storageErr) {
      console.warn("Storage bucket init skipped:", storageErr.message);
    }

    // ── RLS policies ──────────────────────────────────────────
    await sql(`
      DO $$
      BEGIN
        -- Tickets
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'Tickets' AND policyname = 'tickets_select') THEN
          CREATE POLICY tickets_select ON "Tickets" FOR SELECT USING (
            created_by = auth.uid() OR (auth.jwt() ->> 'app_role') = 'admin'
          );
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'Tickets' AND policyname = 'tickets_insert') THEN
          CREATE POLICY tickets_insert ON "Tickets" FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'Tickets' AND policyname = 'tickets_update') THEN
          CREATE POLICY tickets_update ON "Tickets" FOR UPDATE USING (
            (auth.jwt() ->> 'app_role') = 'admin'
          );
        END IF;

        -- auth_users
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'auth_users' AND policyname = 'auth_users_select') THEN
          CREATE POLICY auth_users_select ON auth_users FOR SELECT USING (
            id = auth.uid() OR (auth.jwt() ->> 'app_role') = 'admin'
          );
        END IF;

        -- admin_users
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_users' AND policyname = 'admin_users_select') THEN
          CREATE POLICY admin_users_select ON admin_users FOR SELECT USING (
            (auth.jwt() ->> 'app_role') = 'admin'
          );
        END IF;

        -- ticket_messages
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ticket_messages' AND policyname = 'ticket_messages_select') THEN
          CREATE POLICY ticket_messages_select ON ticket_messages FOR SELECT USING (
            (auth.jwt() ->> 'app_role') = 'admin'
            OR EXISTS (
              SELECT 1 FROM "Tickets" t
              WHERE t.id = ticket_messages.ticket_id AND t.created_by = auth.uid()
            )
          );
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ticket_messages' AND policyname = 'ticket_messages_insert') THEN
          CREATE POLICY ticket_messages_insert ON ticket_messages FOR INSERT WITH CHECK (
            sender_id = auth.uid()
            AND (
              (auth.jwt() ->> 'app_role') = 'admin'
              OR EXISTS (
                SELECT 1 FROM "Tickets" t
                WHERE t.id = ticket_messages.ticket_id AND t.created_by = auth.uid()
              )
            )
          );
        END IF;

        -- ticket_sla_history
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
    `);
    console.log("✓ RLS policies");

    console.log("✓ Database ready");
  } catch (error) {
    console.error("Database initialization error:", error.message);
  }
};

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
      // non-critical
    }
  };

  try {
    const { error: tableCheckError } = await supabase
      .from("admin_users")
      .select("id")
      .limit(1);

    if (isMissingTableError(tableCheckError)) {
      await reloadSchemaCache();
    } else if (tableCheckError) {
      console.error("[Admin init] Table check error:", tableCheckError.message);
      return;
    }

    if (!seedEmail || !seedPassword) {
      console.log(
        "Skipping admin seed (set ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD to seed a root admin).",
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
