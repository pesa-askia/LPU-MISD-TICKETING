import express from "express";
import {
    registerUser,
    loginUser,
    loginAdmin,
    getUserById,
    getAllUsers,
    updateUser,
    deleteUser,
    changePassword,
} from "../services/authService.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

/**
 * POST /api/auth/signup
 * Register a new user
 */
router.post("/signup", async (req, res) => {
    try {
        const { email, password, fullName } = req.body;

        // Validation
        if (!email || !password) {
            return res
                .status(400)
                .json({ success: false, message: "Email and password are required" });
        }

        if (password.length < 6) {
            return res
                .status(400)
                .json({ success: false, message: "Password must be at least 6 characters" });
        }

        const result = await registerUser(email, password, fullName);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(201).json(result);
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Signup error",
            error: error.message,
        });
    }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required",
            });
        }

        const result = await loginUser(email, password);

        if (!result.success) {
            return res.status(401).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Login error",
            error: error.message,
        });
    }
});

/**
 * POST /api/auth/admin-login
 * Login admin (separate pipeline from normal users)
 */
router.post("/admin-login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required",
            });
        }

        const result = await loginAdmin(email, password);

        if (!result.success) {
            return res.status(401).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Admin login error",
            error: error.message,
        });
    }
});

/**
 * GET /api/auth/me
 * Get current user profile (requires auth)
 */
router.get("/me", authMiddleware, async (req, res) => {
    try {
        const result = await getUserById(req.user.id);

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
 * PUT /api/auth/me
 * Update current user profile (requires auth)
 */
router.put("/me", authMiddleware, async (req, res) => {
    try {
        const { fullName } = req.body;

        const result = await updateUser(req.user.id, {
            full_name: fullName,
        });

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(200).json({
            success: true,
            message: "Profile updated",
            user: result.user,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error updating profile",
            error: error.message,
        });
    }
});

/**
 * POST /api/auth/change-password
 * Change password (requires auth)
 */
router.post("/change-password", authMiddleware, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Old and new passwords are required",
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "New password must be at least 6 characters",
            });
        }

        const result = await changePassword(req.user.id, oldPassword, newPassword);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error changing password",
            error: error.message,
        });
    }
});

export default router;
