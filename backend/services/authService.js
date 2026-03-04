import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { supabase } from "../config/database.js";

const JWT_SECRET = process.env.JWT_SECRET || "your_secret_key";

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
export const generateToken = (userId, email) => {
    return jwt.sign({ id: userId, email: email }, JWT_SECRET, {
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
        const { data: existingUser, error: checkError } = await supabase
            .from("auth_users")
            .select("id")
            .eq("email", email)
            .single();

        if (existingUser) {
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
 * Login user
 */
export const loginUser = async (email, password) => {
    try {
        // Find user by email
        const { data: user, error: findError } = await supabase
            .from("auth_users")
            .select("*")
            .eq("email", email)
            .single();

        if (findError || !user) {
            return { success: false, message: "Invalid email or password" };
        }

        if (!user.is_active) {
            return { success: false, message: "User account is inactive" };
        }

        // Compare password
        const isValidPassword = await comparePassword(password, user.password_hash);

        if (!isValidPassword) {
            return { success: false, message: "Invalid email or password" };
        }

        // Generate token
        const token = generateToken(user.id, user.email);

        // Update last login
        await supabase
            .from("auth_users")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", user.id);

        return {
            success: true,
            message: "Login successful",
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
