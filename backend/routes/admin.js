import express from "express";
import bcrypt from "bcryptjs";
import { getAllUsers, getUserById, deleteUser, updateUser } from "../services/authService.js";
import { adminMiddleware, globalAdminMiddleware } from "../middleware/auth.js";
import { supabase } from "../config/database.js";

const resendApiConfigured = () => Boolean(String(process.env.RESEND_API_KEY || "").trim());

const router = express.Router();

async function getRootAdminId() {
    const { data } = await supabase
        .from("admin_users")
        .select("id")
        .eq("admin_level", 0)
        .order("created_at", { ascending: true })
        .limit(1);
    return data?.[0]?.id ?? null;
}

/**
 * GET /api/admin/users
 * Get all users (paginated) — Global Admin only
 */
router.get("/users", globalAdminMiddleware, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;

        const result = await getAllUsers(limit, offset);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(200).json({
            success: true,
            data: result.users,
            pagination: {
                limit: limit,
                offset: offset,
                total: result.total,
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error fetching users",
            error: error.message,
        });
    }
});

/**
 * GET /api/admin/users/:userId
 * Get specific user details — Global Admin only
 */
router.get("/users/:userId", globalAdminMiddleware, async (req, res) => {
    try {
        const result = await getUserById(req.params.userId);

        if (!result.success) {
            return res.status(404).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error fetching user",
            error: error.message,
        });
    }
});

/**
 * PUT /api/admin/users/:userId
 * Update user — Global Admin only
 */
router.put("/users/:userId", globalAdminMiddleware, async (req, res) => {
    try {
        const { fullName, isActive } = req.body;

        const updates = {};
        if (fullName !== undefined) updates.full_name = fullName;
        if (isActive !== undefined) updates.is_active = isActive;

        const result = await updateUser(req.params.userId, updates);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(200).json({
            success: true,
            message: "User updated",
            user: result.user,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error updating user",
            error: error.message,
        });
    }
});

/**
 * DELETE /api/admin/users/:userId
 * Delete user — Global Admin only
 */
router.delete("/users/:userId", globalAdminMiddleware, async (req, res) => {
    try {
        if (req.params.userId === req.user.id) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete your own account",
            });
        }

        const result = await deleteUser(req.params.userId);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error deleting user",
            error: error.message,
        });
    }
});

/**
 * GET /api/admin/stats
 * Get authentication statistics — Global Admin only
 */
router.get("/stats", globalAdminMiddleware, async (req, res) => {
    try {
        const result = await getAllUsers(1000, 0);

        if (!result.success) {
            return res.status(400).json(result);
        }

        const users = result.users;
        const activeUsers = users.filter((u) => u.is_active).length;
        const inactiveUsers = users.filter((u) => !u.is_active).length;

        return res.status(200).json({
            success: true,
            stats: {
                totalUsers: result.total,
                activeUsers: activeUsers,
                inactiveUsers: inactiveUsers,
                createdToday: users.filter((u) => {
                    const today = new Date().toDateString();
                    return new Date(u.created_at).toDateString() === today;
                }).length,
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error fetching stats",
            error: error.message,
        });
    }
});

/**
 * GET /api/admin/assignees
 * Any admin — returns all active admins that can be assigned tickets (excludes self).
 */
router.get("/assignees", adminMiddleware, async (req, res) => {
    try {
        const callerId = req.user?.id;
        const isTicketAdmin = Number(req.user?.admin_level) === 1;

        const { data: selfData } = await supabase
            .from("admin_users")
            .select("id, full_name, email, admin_level")
            .eq("id", callerId)
            .limit(1);

        const selfRow = selfData?.[0];

        if (isTicketAdmin) {
            return res.status(200).json({ success: true, data: selfRow ? [selfRow] : [] });
        }

        let othersQuery = supabase
            .from("admin_users")
            .select("id, full_name, email, admin_level")
            .eq("is_active", true)
            .neq("id", callerId);

        if (resendApiConfigured()) {
            othersQuery = othersQuery.not("email_verified_at", "is", null);
        }

        const { data: others, error } = await othersQuery;

        if (error) return res.status(400).json({ success: false, message: error.message });

        const sorted = (others || []).sort((a, b) => a.admin_level - b.admin_level);
        const data = selfRow ? [selfRow, ...sorted] : sorted;

        return res.status(200).json({ success: true, data });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
});

/**
 * GET /api/admin/staff
 * Any admin — returns id + name + email for all active admins (used for name lookups).
 */
router.get("/staff", adminMiddleware, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("admin_users")
            .select("id, full_name, email, admin_level")
            .eq("is_active", true)
            .order("admin_level", { ascending: true });

        if (error) return res.status(400).json({ success: false, message: error.message });

        return res.status(200).json({ success: true, data: data || [] });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
});

/**
 * GET /api/admin/me
 * Any admin — returns their own profile.
 */
router.get("/me", adminMiddleware, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("admin_users")
            .select("id, email, full_name, admin_level, email_verified_at")
            .eq("id", req.user.id)
            .single();

        if (error) return res.status(400).json({ success: false, message: error.message });

        return res.status(200).json({ success: true, data });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
});

/**
 * GET /api/admin/admins
 * Global Admin only — list all admin accounts.
 */
router.get("/admins", globalAdminMiddleware, async (req, res) => {
    try {
        const [{ data, error }, rootAdminId] = await Promise.all([
            supabase
                .from("admin_users")
                .select("id, email, full_name, is_active, admin_level, email_verified_at, created_at, updated_at")
                .order("admin_level", { ascending: true }),
            getRootAdminId(),
        ]);

        if (error) return res.status(400).json({ success: false, message: error.message });

        const enriched = (data || []).map((a) => ({ ...a, is_root: a.id === rootAdminId }));
        return res.status(200).json({ success: true, data: enriched });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
});

/**
 * POST /api/admin/admins
 * Global Admin only — create a new admin account.
 * Body: { email, password, fullName, adminLevel }
 */
router.post("/admins", globalAdminMiddleware, async (req, res) => {
    try {
        const { email, password, fullName, adminLevel } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: "email and password are required" });
        }

        const level = Number(adminLevel);
        if (![0, 1].includes(level)) {
            return res.status(400).json({ success: false, message: "adminLevel must be 0 (Global Admin) or 1 (Ticket Admin)" });
        }

        const { data: existing } = await supabase
            .from("admin_users")
            .select("id")
            .eq("email", email.toLowerCase())
            .limit(1);

        if (existing && existing.length > 0) {
            return res.status(409).json({ success: false, message: "An admin with that email already exists" });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const { data, error } = await supabase
            .from("admin_users")
            .insert([{
                email: email.toLowerCase(),
                password_hash: passwordHash,
                full_name: fullName || email.split("@")[0],
                is_active: true,
                admin_level: level,
                email_verified_at: null,
            }])
            .select("id, email, full_name, is_active, admin_level, email_verified_at, created_at, updated_at");

        if (error) return res.status(400).json({ success: false, message: error.message });

        const created = data[0];
        let invitationEmailSent = false;
        let invitationEmailError = null;

        try {
            const rawBase =
                process.env.PUBLIC_BASE_URL ||
                (process.env.CORS_ORIGINS || "").split(",")[0].trim() ||
                "http://localhost:5173";
            const publicBase = (/^https?:\/\//i.test(rawBase) ? rawBase : `http://${rawBase}`)
                .replace(/\/$/, "");
            const verifyUrl = `${publicBase}/admin/verify-email`;
            const { data: inviteData, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(
                email.toLowerCase(),
                {
                    redirectTo: verifyUrl,
                    data: { full_name: created.full_name, admin_level: level, role: "admin" },
                },
            );
            if (!inviteErr && inviteData?.user?.id) {
                await supabase.from("admin_users")
                    .update({ supabase_auth_id: inviteData.user.id })
                    .eq("id", created.id);
                invitationEmailSent = true;
            } else if (inviteErr) {
                invitationEmailError = inviteErr.message;
                console.error("[admin create] Supabase invite error:", inviteErr.message);
            }
        } catch (inviteEx) {
            invitationEmailError = inviteEx.message;
            console.error("[admin create] Supabase invite exception:", inviteEx.message);
        }

        return res.status(201).json({
            success: true,
            data: created,
            verifyEmail: true,
            invitationEmailSent,
            invitationEmailError,
        });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
});

/**
 * DELETE /api/admin/admins/:adminId
 * Global Admin only — delete an admin account.
 */
router.delete("/admins/:adminId", globalAdminMiddleware, async (req, res) => {
    try {
        const { adminId } = req.params;
        const callerId = req.user?.id || req.user?.sub;

        if (!adminId) {
            return res.status(400).json({ success: false, message: "adminId is required" });
        }

        if (adminId === callerId) {
            return res.status(400).json({ success: false, message: "Cannot delete your own account" });
        }

        const rootAdminId = await getRootAdminId();
        if (adminId === rootAdminId) {
            return res.status(403).json({ success: false, message: "Cannot delete the root admin account" });
        }

        const { data: existing, error: findErr } = await supabase
            .from("admin_users")
            .select("id, email, full_name, admin_level, supabase_auth_id")
            .eq("id", adminId)
            .limit(1);

        if (findErr) return res.status(400).json({ success: false, message: findErr.message });
        if (!existing || existing.length === 0) {
            return res.status(404).json({ success: false, message: "Admin not found" });
        }

        const target = existing[0];
        if (Number(target.admin_level) === 0) {
            const { data: globalAdmins, error: gaErr } = await supabase
                .from("admin_users")
                .select("id")
                .eq("admin_level", 0);
            if (gaErr) return res.status(400).json({ success: false, message: gaErr.message });
            if ((globalAdmins || []).length <= 1) {
                return res.status(400).json({ success: false, message: "Cannot delete the last global admin" });
            }
        }

        const { error: delErr } = await supabase.from("admin_users").delete().eq("id", adminId);
        if (delErr) return res.status(400).json({ success: false, message: delErr.message });

        if (target.supabase_auth_id) {
            try {
                await supabase.auth.admin.deleteUser(target.supabase_auth_id);
            } catch (authDelErr) {
                console.warn("[admin delete] Supabase Auth cleanup failed:", authDelErr.message);
            }
        }

        return res.status(200).json({
            success: true,
            message: "Admin deleted",
            data: { id: target.id, email: target.email, full_name: target.full_name },
        });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
});

/**
 * PATCH /api/admin/admins/:adminId
 * Global Admin only — update an admin's level or active status.
 * Body: { adminLevel?, isActive? }
 */
router.patch("/admins/:adminId", globalAdminMiddleware, async (req, res) => {
    try {
        const { adminId } = req.params;

        if (adminId === req.user.id) {
            return res.status(400).json({ success: false, message: "Cannot edit your own account" });
        }

        const rootAdminId = await getRootAdminId();
        if (adminId === rootAdminId) {
            return res.status(403).json({ success: false, message: "Cannot modify the root admin account" });
        }

        const updates = { updated_at: new Date().toISOString() };

        if (req.body.adminLevel !== undefined) {
            const level = Number(req.body.adminLevel);
            if (![0, 1].includes(level)) {
                return res.status(400).json({ success: false, message: "adminLevel must be 0 (Global Admin) or 1 (Ticket Admin)" });
            }
            updates.admin_level = level;
        }

        if (req.body.isActive !== undefined) updates.is_active = Boolean(req.body.isActive);

        const { data, error } = await supabase
            .from("admin_users")
            .update(updates)
            .eq("id", adminId)
            .select("id, email, full_name, is_active, admin_level, email_verified_at, updated_at");

        if (error) return res.status(400).json({ success: false, message: error.message });
        if (!data || data.length === 0) return res.status(404).json({ success: false, message: "Admin not found" });

        return res.status(200).json({ success: true, data: data[0] });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
});

export default router;
