import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { supabase } from "../config/database.js";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable must be set. Refusing to start.");
}

/**
 * Hash password
 */
export const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
};

/**
 * Compare password with hash
 */
export const comparePassword = async (password, hash) => {
    return await bcrypt.compare(password, hash);
};

/**
 * Generate JWT token
 */
export const generateToken = (userId, email, role = "user") => {
    // sub is the standard JWT subject claim; Supabase uses it for auth.uid() in RLS policies.
    // app_role is used instead of role because Supabase reserves the role claim
    // to set the PostgreSQL execution role — passing role:"admin" would cause
    // "role admin does not exist" errors since it's not a database role.
    return jwt.sign({ sub: userId, id: userId, email, app_role: role }, JWT_SECRET, {
        expiresIn: "7d",
    });
};

/**
 * Verify JWT token
 */
export const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
};

/**
 * Register a new user
 */
export const registerUser = async (email, password, fullName = "") => {
    try {
        // Check if user already exists
        const { data: existingUsers, error: checkError } = await supabase
            .from("auth_users")
            .select("id")
            .eq("email", email);

        if (checkError && checkError.code !== "PGRST116") {
            return { success: false, message: checkError.message };
        }

        if (existingUsers && existingUsers.length > 0) {
            return { success: false, message: "User already exists" };
        }

        // Hash password
        const passwordHash = await hashPassword(password);

        // Insert new user
        const { data, error } = await supabase
            .from("auth_users")
            .insert([
                {
                    email: email,
                    password_hash: passwordHash,
                    full_name: fullName || email.split("@")[0],
                },
            ])
            .select();

        if (error) {
            return { success: false, message: error.message };
        }

        const user = data[0];

        // Generate token
        const token = generateToken(user.id, user.email);

        return {
            success: true,
            message: "User registered successfully",
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
            },
            token: token,
        };
    } catch (error) {
        return { success: false, message: error.message };
    }
};

/**
 * Unified login — checks admin_users and auth_users in parallel to prevent
 * timing-based role enumeration. Admin takes precedence if found in both.
 */
export const loginAny = async (email, password) => {
    try {
        const [adminResult, userResult] = await Promise.all([
            supabase.from("admin_users").select("*").eq("email", email),
            supabase.from("auth_users").select("*").eq("email", email),
        ]);

        const admin = adminResult.data?.[0] ?? null;
        const user = userResult.data?.[0] ?? null;

        // Admin takes precedence if the email exists in both tables
        const account = admin ?? user;
        const role = admin ? "admin" : "user";

        if (!account) {
            return { success: false, message: "Invalid email or password" };
        }

        if (!account.is_active) {
            return { success: false, message: "Account is inactive" };
        }

        if (!account.password_hash) {
            return { success: false, message: "Invalid email or password" };
        }

        const isValid = await comparePassword(password, account.password_hash);
        if (!isValid) {
            return { success: false, message: "Invalid email or password" };
        }

        const token = generateToken(account.id, account.email, role);

        const table = admin ? "admin_users" : "auth_users";
        await supabase
            .from(table)
            .update({ updated_at: new Date().toISOString() })
            .eq("id", account.id);

        return {
            success: true,
            message: "Login successful",
            user: {
                id: account.id,
                email: account.email,
                full_name: account.full_name,
                role,
            },
            token,
        };
    } catch (error) {
        return { success: false, message: error.message };
    }
};

/**
 * Login admin
 */
export const loginAdmin = async (email, password) => {
    try {
        const { data: admins, error: findError } = await supabase
            .from("admin_users")
            .select("*")
            .eq("email", email);

        if (findError) {
            console.error("Supabase query error (admin):", findError);
            return { success: false, message: "Invalid email or password" };
        }

        if (!admins || admins.length === 0) {
            return { success: false, message: "Invalid email or password" };
        }

        const admin = admins[0];

        if (!admin.is_active) {
            return { success: false, message: "Admin account is inactive" };
        }

        if (!admin.password_hash) {
            console.error("Admin found but password_hash is missing");
            return { success: false, message: "Invalid email or password" };
        }

        const isValidPassword = await comparePassword(password, admin.password_hash);

        if (!isValidPassword) {
            return { success: false, message: "Invalid email or password" };
        }

        const token = generateToken(admin.id, admin.email, "admin");

        await supabase
            .from("admin_users")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", admin.id);

        return {
            success: true,
            message: "Admin login successful",
            user: {
                id: admin.id,
                email: admin.email,
                full_name: admin.full_name,
                role: "admin",
            },
            token: token,
        };
    } catch (error) {
        return { success: false, message: error.message };
    }
};

/**
 * Get user by ID
 */
export const getUserById = async (userId) => {
    try {
        const { data: user, error } = await supabase
            .from("auth_users")
            .select("id, email, full_name, is_active, created_at, updated_at")
            .eq("id", userId)
            .single();

        if (error) {
            return { success: false, message: error.message };
        }

        return { success: true, user: user };
    } catch (error) {
        return { success: false, message: error.message };
    }
};

/**
 * Get all users (for monitoring/admin)
 */
export const getAllUsers = async (limit = 100, offset = 0) => {
    try {
        const { data: users, error, count } = await supabase
            .from("auth_users")
            .select("id, email, full_name, is_active, created_at, updated_at", {
                count: "exact",
            })
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            return { success: false, message: error.message };
        }

        return { success: true, users: users, total: count };
    } catch (error) {
        return { success: false, message: error.message };
    }
};

/**
 * Update user
 */
export const updateUser = async (userId, updates) => {
    try {
        const { data, error } = await supabase
            .from("auth_users")
            .update({
                ...updates,
                updated_at: new Date().toISOString(),
            })
            .eq("id", userId)
            .select();

        if (error) {
            return { success: false, message: error.message };
        }

        return { success: true, user: data[0] };
    } catch (error) {
        return { success: false, message: error.message };
    }
};

/**
 * Delete user
 */
export const deleteUser = async (userId) => {
    try {
        const { error } = await supabase.from("auth_users").delete().eq("id", userId);

        if (error) {
            return { success: false, message: error.message };
        }

        return { success: true, message: "User deleted successfully" };
    } catch (error) {
        return { success: false, message: error.message };
    }
};

/**
 * Change password
 */
export const changePassword = async (userId, oldPassword, newPassword) => {
    try {
        // Get user
        const { data: user, error: getUserError } = await supabase
            .from("auth_users")
            .select("*")
            .eq("id", userId)
            .single();

        if (getUserError) {
            return { success: false, message: "User not found" };
        }

        // Verify old password
        const isValidPassword = await comparePassword(oldPassword, user.password_hash);

        if (!isValidPassword) {
            return { success: false, message: "Incorrect old password" };
        }

        // Hash new password
        const newPasswordHash = await hashPassword(newPassword);

        // Update password
        const { error: updateError } = await supabase
            .from("auth_users")
            .update({ password_hash: newPasswordHash })
            .eq("id", userId);

        if (updateError) {
            return { success: false, message: updateError.message };
        }

        return { success: true, message: "Password changed successfully" };
    } catch (error) {
        return { success: false, message: error.message };
    }
};
