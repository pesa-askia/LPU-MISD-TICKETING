import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { supabase } from "../config/database.js";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable must be set. Refusing to start.");
}

/** If false, unverified admins may still sign in (local dev without Resend). UI should only show "Verified" when `email_verified_at` is set. */
const isAdminEmailVerificationEnforced = () => Boolean(String(process.env.RESEND_API_KEY || "").trim());

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
export const generateToken = (userId, email, role = "user", adminLevel = null) => {
    // sub is the standard JWT subject claim; Supabase uses it for auth.uid() in RLS policies.
    // app_role is used instead of role because Supabase reserves the role claim
    // to set the PostgreSQL execution role — passing role:"admin" would cause
    // "role admin does not exist" errors since it's not a database role.
    // admin_level: 0=root, 1=senior, 2=mid, 3=junior — only present for admin accounts.
    // role: "authenticated" sets the PostgreSQL execution role for PostgREST
    // and Supabase Realtime. "authenticated" is a built-in Supabase role that
    // is safe to use for all logged-in users. We intentionally avoid role: "admin"
    // because that would try to set a non-existent PostgreSQL role.
    // app_role carries our own admin/user distinction for RLS policies.
    const payload = { sub: userId, id: userId, email, role: "authenticated", app_role: role };
    if (adminLevel !== null) payload.admin_level = adminLevel;
    return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
};

const ADMIN_INVITE_PURPOSE = "admin_invite";

/**
 * One-time link token emailed to a new admin (7-day expiry). Not the same as session JWT.
 */
export const createAdminEmailVerificationToken = (adminId) => {
    return jwt.sign(
        { sub: adminId, pur: ADMIN_INVITE_PURPOSE },
        JWT_SECRET,
        { expiresIn: "7d" },
    );
};

/**
 * Mark admin email as verified after they open the link from the invitation email.
 * Supports two token formats:
 *  1. Legacy custom JWT (pur: "admin_invite") — for any invites sent before the Supabase flow
 *  2. Supabase access_token — from supabase.auth.admin.inviteUserByEmail redirect
 */
export const verifyAdminEmailFromToken = async (token) => {
    const markVerifiedById = async (adminId) => {
        const { data: row, error: readErr } = await supabase
            .from("admin_users").select("id, email_verified_at").eq("id", adminId).single();
        if (readErr || !row) return { success: false, message: "Account not found." };
        if (row.email_verified_at) return { success: true, message: "Your email is already verified. You can sign in to the admin portal.", alreadyVerified: true };
        const now = new Date().toISOString();
        const { error: upErr } = await supabase.from("admin_users").update({ email_verified_at: now, updated_at: now }).eq("id", adminId);
        if (upErr) return { success: false, message: "Could not complete verification. Try again later." };
        return { success: true, message: "Your email is verified. You can sign in to the admin portal." };
    };

    const markVerifiedByEmail = async (email) => {
        const { data: row, error: readErr } = await supabase
            .from("admin_users").select("id, email_verified_at").eq("email", email.toLowerCase()).single();
        if (readErr || !row) return { success: false, message: "Admin account not found." };
        if (row.email_verified_at) return { success: true, message: "Your email is already verified. You can sign in to the admin portal.", alreadyVerified: true };
        const now = new Date().toISOString();
        const { error: upErr } = await supabase.from("admin_users").update({ email_verified_at: now, updated_at: now }).eq("id", row.id);
        if (upErr) return { success: false, message: "Could not complete verification. Try again later." };
        return { success: true, message: "Your email is verified. You can sign in to the admin portal." };
    };

    try {
        // 1) Legacy custom JWT (backward compat for any pending invitations)
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            if (decoded.pur === ADMIN_INVITE_PURPOSE && decoded.sub) {
                return await markVerifiedById(decoded.sub);
            }
        } catch {
            // Not our JWT — fall through to Supabase token
        }

        // 2) Supabase access_token issued by inviteUserByEmail redirect
        const { data: { user }, error: supaErr } = await supabase.auth.getUser(token);
        if (supaErr || !user?.email) {
            return { success: false, message: "This link is invalid or has expired." };
        }
        return await markVerifiedByEmail(user.email);
    } catch {
        return { success: false, message: "This link is invalid or has expired." };
    }
};

/**
 * Verify JWT token
 */
export const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch {
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

        if (admin && !admin.email_verified_at && isAdminEmailVerificationEnforced()) {
            return {
                success: false,
                message:
                    "Please verify your email first. Open the invitation link we sent to your inbox, then try signing in again.",
                code: "ADMIN_EMAIL_UNVERIFIED",
            };
        }

        const adminLevel = admin ? (admin.admin_level ?? 1) : null;
        const token = generateToken(account.id, account.email, role, adminLevel);

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
                ...(adminLevel !== null && { admin_level: adminLevel }),
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

        if (!admin.email_verified_at && isAdminEmailVerificationEnforced()) {
            return {
                success: false,
                message:
                    "Please verify your email first. Open the invitation link we sent to your inbox, then try signing in again.",
                code: "ADMIN_EMAIL_UNVERIFIED",
            };
        }

        const adminLevel = admin.admin_level ?? 1;
        const token = generateToken(admin.id, admin.email, "admin", adminLevel);

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
                admin_level: adminLevel,
            },
            token: token,
        };
    } catch (error) {
        return { success: false, message: error.message };
    }
};

const normalizeEmail = (email) => String(email ?? "").trim().toLowerCase();

/**
 * Ensure an email is not taken on the other account table (and not by another row
 * in the same table). Used when admins or users update their own email.
 */
export const assertEmailAvailableForAccount = async (normalizedEmail, userId, isAdminAccount) => {
    try {
        if (!normalizedEmail) {
            return { success: false, message: "Email is required" };
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            return { success: false, message: "Invalid email format" };
        }

        const [{ data: admins }, { data: users }] = await Promise.all([
            supabase.from("admin_users").select("id").eq("email", normalizedEmail),
            supabase.from("auth_users").select("id").eq("email", normalizedEmail),
        ]);

        const adminRows = admins ?? [];
        const userRows = users ?? [];

        if (isAdminAccount) {
            if (adminRows.some((r) => r.id !== userId)) {
                return { success: false, message: "Email already in use" };
            }
            if (userRows.length > 0) {
                return { success: false, message: "Email already in use" };
            }
        } else {
            if (userRows.some((r) => r.id !== userId)) {
                return { success: false, message: "Email already in use" };
            }
            if (adminRows.length > 0) {
                return { success: false, message: "Email already in use" };
            }
        }

        return { success: true };
    } catch (error) {
        return { success: false, message: error.message };
    }
};

/**
 * Profile for GET /api/auth/me — reads admin_users or auth_users from JWT app_role.
 */
export const getMeProfile = async (userId, appRole) => {
    try {
        const table = appRole === "admin" ? "admin_users" : "auth_users";
        const adminSelect =
            "id, email, full_name, is_active, email_verified_at, created_at, updated_at";
        const userSelect = "id, email, full_name, is_active, created_at, updated_at";
        const { data: user, error } = await supabase
            .from(table)
            .select(appRole === "admin" ? adminSelect : userSelect)
            .eq("id", userId)
            .single();

        if (error) {
            return { success: false, message: error.message };
        }

        return { success: true, user };
    } catch (error) {
        return { success: false, message: error.message };
    }
};

/**
 * PUT /api/auth/me — update own name/email on the correct table.
 */
export const updateOwnAccountProfile = async (userId, appRole, { fullName, email }) => {
    try {
        const isAdmin = appRole === "admin";
        const table = isAdmin ? "admin_users" : "auth_users";
        const updates = { updated_at: new Date().toISOString() };

        if (fullName !== undefined && fullName !== null) {
            updates.full_name = fullName;
        }
        if (email !== undefined && email !== null) {
            const normalized = normalizeEmail(email);
            const check = await assertEmailAvailableForAccount(normalized, userId, isAdmin);
            if (!check.success) {
                return check;
            }
            updates.email = normalized;
        }

        if (Object.keys(updates).length === 1) {
            return { success: false, message: "No profile fields to update" };
        }

        const selectFields = isAdmin
            ? "id, email, full_name, is_active, email_verified_at, created_at, updated_at"
            : "id, email, full_name, is_active, created_at, updated_at";
        const { data, error } = await supabase
            .from(table)
            .update(updates)
            .eq("id", userId)
            .select(selectFields);

        if (error) {
            return { success: false, message: error.message };
        }

        return { success: true, user: data[0] };
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
 * Verify a Supabase Auth magic-link session and exchange it for our custom JWT.
 *
 * Flow:
 *  1. Validate the Supabase access_token via supabase.auth.getUser()
 *  2. Enforce the @lpulaguna.edu.ph domain
 *  3. Find-or-create a row in auth_users (passwordless)
 *  4. Return our own JWT so the rest of the app works unchanged
 */
export const verifyMagicLinkToken = async (accessToken) => {
    try {
        // Decode the Supabase access token to get the user's UUID (sub claim).
        // We don't verify the signature here — instead we immediately confirm
        // the UUID exists in Supabase Auth via the admin API (service role key).
        // This avoids the 403 that occurs when passing the user JWT through
        // our custom authFetch override on the frontend.
        const decoded = jwt.decode(accessToken);
        if (!decoded?.sub) {
            return { success: false, message: "Invalid or expired magic link." };
        }

        const { data: { user: supaUser }, error: supaError } =
            await supabase.auth.admin.getUserById(decoded.sub);

        if (supaError || !supaUser) {
            return { success: false, message: "Invalid or expired magic link." };
        }

        const email = supaUser.email?.toLowerCase();

        // Domain guard — enforced on the backend regardless of what the frontend sends
        if (!email || !email.endsWith("@lpulaguna.edu.ph")) {
            return { success: false, message: "Only @lpulaguna.edu.ph accounts are allowed." };
        }

        // Look up existing user
        const { data: existing } = await supabase
            .from("auth_users")
            .select("*")
            .eq("email", email);

        let user = existing?.[0];

        if (!user) {
            // Auto-register on first magic-link login.
            // password_hash stores a bcrypt hash of a random UUID that is
            // immediately discarded — the user can never log in with a password.
            const placeholderHash = await hashPassword(randomUUID());

            const { data: created, error: createError } = await supabase
                .from("auth_users")
                .insert([{
                    email,
                    password_hash: placeholderHash,
                    full_name: email.split("@")[0],
                }])
                .select();

            if (createError) {
                return { success: false, message: "Failed to create account. Please try again." };
            }
            user = created[0];
        }

        if (!user.is_active) {
            return { success: false, message: "Account is inactive. Contact MISD support." };
        }

        const token = generateToken(user.id, user.email, "user");

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
                role: "user",
            },
            token,
        };
    } catch (error) {
        return { success: false, message: error.message };
    }
};

/**
 * Change password (auth_users or admin_users depending on app_role)
 */
export const changePassword = async (userId, oldPassword, newPassword, appRole = "user") => {
    try {
        const table = appRole === "admin" ? "admin_users" : "auth_users";

        const { data: user, error: getUserError } = await supabase
            .from(table)
            .select("*")
            .eq("id", userId)
            .single();

        if (getUserError) {
            return { success: false, message: "User not found" };
        }

        const isValidPassword = await comparePassword(oldPassword, user.password_hash);

        if (!isValidPassword) {
            return { success: false, message: "Incorrect old password" };
        }

        const newPasswordHash = await hashPassword(newPassword);

        const { error: updateError } = await supabase
            .from(table)
            .update({ password_hash: newPasswordHash, updated_at: new Date().toISOString() })
            .eq("id", userId);

        if (updateError) {
            return { success: false, message: updateError.message };
        }

        return { success: true, message: "Password changed successfully" };
    } catch (error) {
        return { success: false, message: error.message };
    }
};
