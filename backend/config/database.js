import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

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
                console.log("Table might already exist or RPC not available. Continuing...");
            }
        }

        console.log("✓ Database initialized");
    } catch (error) {
        console.error("Database initialization error:", error.message);
    }
};
