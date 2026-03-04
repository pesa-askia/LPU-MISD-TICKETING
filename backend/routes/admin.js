import express from "express";
import { getAllUsers, getUserById, deleteUser, updateUser } from "../services/authService.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

/**
 * GET /api/admin/users
 * Get all users (paginated)
 * Query params: limit=100, offset=0
 */
router.get("/users", authMiddleware, async (req, res) => {
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
router.get("/users/:userId", authMiddleware, async (req, res) => {
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
router.put("/users/:userId", authMiddleware, async (req, res) => {
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
router.delete("/users/:userId", authMiddleware, async (req, res) => {
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
router.get("/stats", authMiddleware, async (req, res) => {
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

export default router;
