import express from "express";
import bcrypt from "bcryptjs";
import { getAllUsers, getUserById, deleteUser, updateUser, createAdminEmailVerificationToken } from "../services/authService.js";
import { sendAdminInviteEmail, isAdminInviteEmailEnabled } from "../services/adminInviteMailer.js";
import { adminMiddleware, rootMiddleware } from "../middleware/auth.js";
import { supabase } from "../config/database.js";
import {
    canAssignToAdminLevel,
    compareAdminsByPrivilege,
} from "../utils/adminLevels.js";

const resendApiConfigured = () => Boolean(String(process.env.RESEND_API_KEY || "").trim());

const router = express.Router();

/**
 * GET /api/admin/users
 * Get all users (paginated)
 * Query params: limit=100, offset=0
 */
router.get("/users", adminMiddleware, async (req, res) => {
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
 * Get specific user details
 */
router.get("/users/:userId", adminMiddleware, async (req, res) => {
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
 * Update user (deactivate, change name, etc.)
 */
router.put("/users/:userId", adminMiddleware, async (req, res) => {
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
 * Delete user
 */
router.delete("/users/:userId", adminMiddleware, async (req, res) => {
    try {
        // Prevent user from deleting themselves
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
 * Get authentication statistics
 */
router.get("/stats", adminMiddleware, async (req, res) => {
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
 * Returns admin users that the caller is allowed to assign tickets to.
 * Rule: you can assign to admins with lower privilege than yours.
 * Root (0) → everyone; Level 1 (3) → levels 2 & 3; Level 2 (2) → level 3; Level 3 (1) → nobody.
 */
router.get("/assignees", adminMiddleware, async (req, res) => {
    try {
        const callerLevel = req.user?.admin_level ?? 1;
        const callerId = req.user?.id;

        let assigneeQuery = supabase
            .from("admin_users")
            .select("id, full_name, email, admin_level")
            .eq("is_active", true)
            .neq("id", callerId);
        if (resendApiConfigured()) {
            assigneeQuery = assigneeQuery.not("email_verified_at", "is", null);
        }
        const { data: admins, error } = await assigneeQuery;

        if (error) return res.status(400).json({ success: false, message: error.message });

        const { data: self } = await supabase
            .from("admin_users")
            .select("id, full_name, email, admin_level")
            .eq("id", callerId)
            .limit(1);

        const selfRow = self?.[0];
        const assignableAdmins = (admins || [])
            .filter((admin) => canAssignToAdminLevel(callerLevel, admin.admin_level))
            .sort(compareAdminsByPrivilege);
        const data = selfRow ? [selfRow, ...assignableAdmins] : assignableAdmins;

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
            .eq("is_active", true);

        if (error) return res.status(400).json({ success: false, message: error.message });

        return res.status(200).json({
            success: true,
            data: (data || []).sort(compareAdminsByPrivilege),
        });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
});

/**
 * GET /api/admin/me
 * Any admin — returns their own profile including filter fields.
 */
router.get("/me", adminMiddleware, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("admin_users")
            .select("id, email, full_name, admin_level, email_verified_at, filter_type, filter_department, filter_category, filter_site")
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
 * Root only — list all admin accounts including filter fields.
 */
router.get("/admins", rootMiddleware, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("admin_users")
            .select("id, email, full_name, is_active, admin_level, email_verified_at, filter_type, filter_department, filter_category, filter_site, created_at, updated_at");

        if (error) return res.status(400).json({ success: false, message: error.message });

        return res.status(200).json({
            success: true,
            data: (data || []).sort(compareAdminsByPrivilege),
        });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
});

/**
 * POST /api/admin/admins
 * Root only — create a new admin account.
 * Body: { email, password, fullName, adminLevel }
 */
router.post("/admins", rootMiddleware, async (req, res) => {
    try {
        const { email, password, fullName, adminLevel } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: "email and password are required" });
        }

        const level = Number(adminLevel);
        if (![0, 1, 2, 3].includes(level)) {
            return res.status(400).json({ success: false, message: "adminLevel must be 0, 1, 2, or 3" });
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
        const inviteEnabled = isAdminInviteEmailEnabled();
        // Only the verification link (or manual SQL) sets email_verified_at. Never set it here — otherwise
        // the UI shows "Verified" before the user actually verifies.

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

        if (inviteEnabled) {
            const publicBase = (process.env.PUBLIC_BASE_URL || process.env.FRONTEND_URL || "http://localhost:5173")
                .replace(/\/$/, "");
            const token = createAdminEmailVerificationToken(created.id);
            const verifyUrl = `${publicBase}/admin/verify-email?token=${encodeURIComponent(token)}`;
            const send = await sendAdminInviteEmail({
                to: created.email,
                fullName: created.full_name,
                verifyUrl,
            });
            invitationEmailSent = send.success;
            if (!send.success) {
                invitationEmailError = send.error || "Failed to send email";
                console.error("[admin create] invite email error:", invitationEmailError);
            } else {
                console.log("[admin create] invite email sent via", send.provider);
            }
        }

        return res.status(201).json({
            success: true,
            data: created,
            verifyEmail: inviteEnabled,
            invitationEmailSent: inviteEnabled ? invitationEmailSent : false,
            invitationEmailError: inviteEnabled ? invitationEmailError : null,
        });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
});

/**
 * DELETE /api/admin/admins/:adminId
 * Root only — delete an admin account.
 */
router.delete("/admins/:adminId", rootMiddleware, async (req, res) => {
    try {
        const { adminId } = req.params;
        const callerId = req.user?.id || req.user?.sub;

        if (!adminId) {
            return res.status(400).json({ success: false, message: "adminId is required" });
        }

        if (adminId === callerId) {
            return res.status(400).json({ success: false, message: "Cannot delete your own account" });
        }

        const { data: existing, error: findErr } = await supabase
            .from("admin_users")
            .select("id, email, full_name, admin_level")
            .eq("id", adminId)
            .limit(1);

        if (findErr) return res.status(400).json({ success: false, message: findErr.message });
        if (!existing || existing.length === 0) {
            return res.status(404).json({ success: false, message: "Admin not found" });
        }

        // Safety: avoid deleting the last remaining root admin
        const target = existing[0];
        if (Number(target.admin_level) === 0) {
            const { data: roots, error: rootsErr } = await supabase
                .from("admin_users")
                .select("id")
                .eq("admin_level", 0);
            if (rootsErr) return res.status(400).json({ success: false, message: rootsErr.message });
            if ((roots || []).length <= 1) {
                return res.status(400).json({ success: false, message: "Cannot delete the last root admin" });
            }
        }

        const { error: delErr } = await supabase.from("admin_users").delete().eq("id", adminId);
        if (delErr) return res.status(400).json({ success: false, message: delErr.message });

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
 * Root only — update an admin's level, active status, and/or ticket filters.
 * Body: { adminLevel?, isActive?, filterType?, filterDepartment?, filterCategory?, filterSite? }
 */
router.patch("/admins/:adminId", rootMiddleware, async (req, res) => {
    try {
        const { adminId } = req.params;

        if (adminId === req.user.id) {
            return res.status(400).json({ success: false, message: "Cannot edit your own account" });
        }

        const updates = { updated_at: new Date().toISOString() };

        if (req.body.adminLevel !== undefined) {
            const level = Number(req.body.adminLevel);
            if (![0, 1, 2, 3].includes(level)) {
                return res.status(400).json({ success: false, message: "adminLevel must be 0, 1, 2, or 3" });
            }
            updates.admin_level = level;
        }

        if (req.body.isActive !== undefined) updates.is_active = Boolean(req.body.isActive);

        // Ticket visibility filters (null clears the filter)
        if ("filterType"       in req.body) updates.filter_type       = req.body.filterType       || null;
        if ("filterDepartment" in req.body) updates.filter_department = req.body.filterDepartment || null;
        if ("filterCategory"   in req.body) updates.filter_category   = req.body.filterCategory   || null;
        if ("filterSite"       in req.body) updates.filter_site       = req.body.filterSite       || null;

        const { data, error } = await supabase
            .from("admin_users")
            .update(updates)
            .eq("id", adminId)
            .select("id, email, full_name, is_active, admin_level, email_verified_at, filter_type, filter_department, filter_category, filter_site, updated_at");

        if (error) return res.status(400).json({ success: false, message: error.message });
        if (!data || data.length === 0) return res.status(404).json({ success: false, message: "Admin not found" });

        return res.status(200).json({ success: true, data: data[0] });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
});

export default router;
