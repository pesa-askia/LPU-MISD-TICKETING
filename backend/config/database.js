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

  try {
    // Check if table exists
    const { error: tableCheckError } = await supabase
      .from("admin_users")
      .select("id")
      .limit(1);

    if (tableCheckError && tableCheckError.code === "PGRST116") {
      console.log("Creating admin_users table...");
      const { error: createError } = await supabase.rpc("execute_sql", {
        sql: `
          CREATE TABLE IF NOT EXISTS admin_users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            full_name VARCHAR(255),
            is_active BOOLEAN DEFAULT true,
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
    }

    // Seed mock admin (only if env vars provided)
    if (!seedEmail || !seedPassword) {
      console.log(
        "Skipping admin seed (set ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD to create a mock admin).",
      );
      return;
    }

    const { data: existing, error: findError } = await supabase
      .from("admin_users")
      .select("id")
      .eq("email", seedEmail);

    if (findError && findError.code !== "PGRST116") {
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
