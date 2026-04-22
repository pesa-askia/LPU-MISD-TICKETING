import { useEffect, useState } from "react";
import { X, User } from "lucide-react";
import { getApiBaseUrl } from "../../../utils/apiBaseUrl";
import { realtimeSupabase } from "../../../lib/realtimeSupabaseClient";
import "../AdminManage.css";

function getAuthHeader() {
    return {
        Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
    };
}

function apiUrl(path) {
    return `${getApiBaseUrl()}${path}`;
}

/**
 * Lets any logged-in admin update their own name, email, and password
 * (backend routes /api/auth/me and /api/auth/change-password).
 */
export default function AdminAccountSettingsModal({ open, onClose }) {
    const [loading, setLoading] = useState(false);
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [profileMsg, setProfileMsg] = useState("");
    const [profileErr, setProfileErr] = useState("");
    const [savingProfile, setSavingProfile] = useState(false);

    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [pwMsg, setPwMsg] = useState("");
    const [pwErr, setPwErr] = useState("");
    const [savingPw, setSavingPw] = useState(false);

    useEffect(() => {
        if (!open) return;
        setProfileMsg("");
        setProfileErr("");
        setPwMsg("");
        setPwErr("");
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");

        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const res = await fetch(apiUrl("/api/auth/me"), {
                    headers: getAuthHeader(),
                });
                const json = await res.json();
                if (cancelled) return;
                if (!json.success || !json.user) {
                    setProfileErr(json.message || "Could not load profile");
                    return;
                }
                setFullName(json.user.full_name || "");
                setEmail(json.user.email || "");
            } catch (e) {
                if (!cancelled) {
                    setProfileErr(e.message || "Could not load profile");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [open]);

    const applySessionToken = (token) => {
        if (!token) return;
        localStorage.setItem("authToken", token);
        realtimeSupabase.realtime.setAuth(token);
    };

    const onSaveProfile = async (e) => {
        e.preventDefault();
        setProfileErr("");
        setProfileMsg("");
        setSavingProfile(true);
        try {
            const res = await fetch(apiUrl("/api/auth/me"), {
                method: "PUT",
                headers: {
                    ...getAuthHeader(),
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ fullName, email }),
            });
            const json = await res.json();
            if (!json.success) {
                setProfileErr(json.message || "Update failed");
                return;
            }
            if (json.user?.email) {
                localStorage.setItem("userEmail", json.user.email);
            }
            if (json.user?.full_name !== undefined) {
                localStorage.setItem("userFullName", json.user.full_name || "");
            }
            applySessionToken(json.token);
            setProfileMsg("Profile saved.");
        } catch (err) {
            setProfileErr(err.message || "Update failed");
        } finally {
            setSavingProfile(false);
        }
    };

    const onChangePassword = async (e) => {
        e.preventDefault();
        setPwErr("");
        setPwMsg("");
        if (newPassword.length < 6) {
            setPwErr("New password must be at least 6 characters.");
            return;
        }
        if (newPassword !== confirmPassword) {
            setPwErr("New passwords do not match.");
            return;
        }
        setSavingPw(true);
        try {
            const res = await fetch(apiUrl("/api/auth/change-password"), {
                method: "POST",
                headers: {
                    ...getAuthHeader(),
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ oldPassword, newPassword }),
            });
            const json = await res.json();
            if (!json.success) {
                setPwErr(json.message || "Could not change password");
                return;
            }
            setOldPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setPwMsg("Password updated.");
        } catch (err) {
            setPwErr(err.message || "Could not change password");
        } finally {
            setSavingPw(false);
        }
    };

    if (!open) return null;

    return (
        <div
            className="manage-modal-overlay"
            onClick={onClose}
            role="dialog"
            aria-labelledby="admin-account-title"
        >
            <div
                className="manage-modal manage-modal-wide"
                onClick={(ev) => ev.stopPropagation()}
            >
                <div className="manage-modal-header">
                    <span id="admin-account-title">My account</span>
                    <button
                        type="button"
                        className="manage-modal-close"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="manage-modal-form manage-account-body">
                    {loading ? (
                        <p className="manage-modal-err" style={{ marginTop: 12 }}>
                            Loading…
                        </p>
                    ) : (
                        <>
                            <div className="manage-account-section">
                                <h3 className="manage-account-section-title">
                                    <User size={16} aria-hidden />
                                    Profile
                                </h3>
                                <form onSubmit={onSaveProfile}>
                                    <label>
                                        Full name
                                        <input
                                            value={fullName}
                                            onChange={(e) =>
                                                setFullName(e.target.value)
                                            }
                                            placeholder="Your name"
                                            autoComplete="name"
                                        />
                                    </label>
                                    <label>
                                        Email
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) =>
                                                setEmail(e.target.value)
                                            }
                                            autoComplete="email"
                                        />
                                    </label>
                                    {profileErr && (
                                        <p className="manage-modal-err">
                                            {profileErr}
                                        </p>
                                    )}
                                    {profileMsg && (
                                        <p className="manage-account-ok">
                                            {profileMsg}
                                        </p>
                                    )}
                                    <div className="manage-modal-actions">
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            disabled={savingProfile}
                                        >
                                            Close
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={savingProfile}
                                            className="manage-modal-submit"
                                        >
                                            {savingProfile
                                                ? "Saving…"
                                                : "Save profile"}
                                        </button>
                                    </div>
                                </form>
                            </div>

                            <hr className="manage-account-divider" />

                            <div className="manage-account-section">
                                <h3 className="manage-account-section-title">
                                    Password
                                </h3>
                                <form onSubmit={onChangePassword}>
                                    <label>
                                        Current password
                                        <input
                                            type="password"
                                            value={oldPassword}
                                            onChange={(e) =>
                                                setOldPassword(e.target.value)
                                            }
                                            autoComplete="current-password"
                                        />
                                    </label>
                                    <label>
                                        New password
                                        <input
                                            type="password"
                                            minLength={6}
                                            value={newPassword}
                                            onChange={(e) =>
                                                setNewPassword(e.target.value)
                                            }
                                            autoComplete="new-password"
                                        />
                                    </label>
                                    <label>
                                        Confirm new password
                                        <input
                                            type="password"
                                            minLength={6}
                                            value={confirmPassword}
                                            onChange={(e) =>
                                                setConfirmPassword(
                                                    e.target.value,
                                                )
                                            }
                                            autoComplete="new-password"
                                        />
                                    </label>
                                    {pwErr && (
                                        <p className="manage-modal-err">
                                            {pwErr}
                                        </p>
                                    )}
                                    {pwMsg && (
                                        <p className="manage-account-ok">
                                            {pwMsg}
                                        </p>
                                    )}
                                    <div className="manage-modal-actions">
                                        <button
                                            type="submit"
                                            disabled={savingPw}
                                            className="manage-modal-submit"
                                        >
                                            {savingPw
                                                ? "Updating…"
                                                : "Change password"}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
