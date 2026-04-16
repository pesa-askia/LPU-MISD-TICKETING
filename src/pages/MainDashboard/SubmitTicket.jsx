import { useState, useRef } from "react";
import { Paperclip, X } from "lucide-react";
import { jwtDecode } from "jwt-decode";
import { realtimeSupabase } from "../../realtimeSupabaseClient";
import { useLoading } from "../../context/LoadingContext";

function SubmitTicket() {
  const { showLoading, hideLoading, isLoading } = useLoading();
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    userType: "",
    department: "",
    category: "",
    description: "",
    summary: "",
    site: "",
  });
  const [attachments, setAttachments] = useState([]);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadAttachment = async (file, userId) => {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `tickets/${userId}/${Date.now()}_${safeName}`;
    const { error } = await realtimeSupabase.storage
      .from("ticket-attachments")
      .upload(path, file, { upsert: false });

    if (error)
      throw new Error(`Upload failed for ${file.name}: ${error.message}`);

    const {
      data: { publicUrl },
    } = realtimeSupabase.storage.from("ticket-attachments").getPublicUrl(path);

    return {
      name: file.name,
      size: file.size,
      type: file.type,
      url: publicUrl,
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    showLoading();
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        setErrorMessage("You must be logged in to submit a ticket.");
        return;
      }

      const decoded = jwtDecode(token);
      const userId = decoded.id;
      const storedEmail = (localStorage.getItem("userEmail") || "").trim();
      const storedName = (localStorage.getItem("userFullName") || "").trim();
      const userEmail = storedEmail || decoded.email || "";
      const userName = storedName || (userEmail ? userEmail.split("@")[0] : "");

      // Upload attachments directly to Supabase Storage (RLS allows writes to own folder)
      const attachmentData = [];
      for (const file of attachments) {
        const meta = await uploadAttachment(file, userId);
        attachmentData.push(meta);
      }

      const descriptionText = formData.description.trim();
      const { data: createdTickets, error } = await realtimeSupabase
        .from("Tickets")
        .insert([
          {
            Summary: formData.summary,
            Description: formData.description,
            Type: formData.userType,
            Department: formData.department,
            Category: formData.category,
            Site: formData.site,
            created_by: userId,
            created_by_name: userName || null,
            created_by_email: userEmail || null,
            status: "Open",
            created_at: new Date().toISOString(),
            attachments: null,
          },
        ])
        .select("id");

      if (error) {
        setErrorMessage(error.message || "Failed to submit ticket");
        return;
      }

      const createdTicket = Array.isArray(createdTickets)
        ? createdTickets[0]
        : createdTickets;

      if (createdTicket?.id && descriptionText) {
        const { error: messageError } = await realtimeSupabase
          .from("ticket_messages")
          .insert([
            {
              ticket_id: createdTicket.id,
              sender_id: userId,
              sender_role: "user",
              sender_name: userName || null,
              sender_email: userEmail || null,
              message_text: descriptionText,
              attachments:
                attachmentData.length > 0
                  ? JSON.stringify(attachmentData)
                  : null,
            },
          ]);

        if (messageError) {
          setSuccessMessage(
            "Ticket submitted, but the initial message failed to post. Open the ticket to send it manually.",
          );
          setTimeout(() => setSuccessMessage(null), 6000);
        } else {
          setSuccessMessage(
            "Ticket submitted successfully! Your ticket has been created.",
          );
          setTimeout(() => setSuccessMessage(null), 5000);
        }
      } else {
        setSuccessMessage(
          "Ticket submitted successfully! Your ticket has been created.",
        );
        setTimeout(() => setSuccessMessage(null), 5000);
      }

      setFormData({
        userType: "",
        department: "",
        category: "",
        description: "",
        summary: "",
        site: "",
      });
      setAttachments([]);
    } catch (err) {
      console.error("Unexpected error:", err);
      setErrorMessage(err.message || "An unexpected error occurred");
    } finally {
      hideLoading();
    }
  };

  return (
    <div className="wrapper">
      <div className="card">
        <h1>Submit Ticket</h1>
        <p>
          Simply create a ticket below. A technician will respond promptly to
          your issue. You may also send tickets directly to &nbsp;
          <a href="mailto:help@lpul-mis.on.spiceworks.com">
            help@lpul-mis.on.spiceworks.com
          </a>
        </p>

        <hr className="divider" />
        {errorMessage && (
          <div
            style={{
              backgroundColor: "#ffebee",
              color: "#d32f2f",
              padding: "12px 16px",
              borderRadius: "4px",
              marginBottom: "16px",
              border: "1px solid #ef5350",
            }}
          >
            <strong>Error:</strong> {errorMessage}
          </div>
        )}
        {successMessage && (
          <div
            style={{
              backgroundColor: "#e8f5e9",
              color: "#2e7d32",
              padding: "12px 16px",
              borderRadius: "4px",
              marginBottom: "16px",
              border: "1px solid #66bb6a",
            }}
          >
            <strong>Success:</strong> {successMessage}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="input-label">
            <textarea
              name="summary"
              placeholder=" "
              value={formData.summary}
              onChange={handleChange}
              required
            ></textarea>
            <label>Summary (Required)</label>
          </div>

          <div className="input-label">
            <textarea
              name="description"
              placeholder=" "
              value={formData.description}
              onChange={handleChange}
              required
            ></textarea>
            <label>Description (Required)</label>
          </div>

          <div className="input-label">
            <select
              name="userType"
              value={formData.userType}
              onChange={handleChange}
              required
            >
              <option value="" disabled hidden></option>
              <option value="STUDENT">STUDENT</option>
              <option value="FACULTY">FACULTY</option>
              <option value="ADMIN">ADMIN</option>
            </select>
            <label>Type (Required)</label>
          </div>

          <div className="input-label">
            <select
              name="department"
              value={formData.department}
              onChange={handleChange}
              required
            >
              <option value="" disabled hidden></option>
              <option value="CAS">CAS</option>
              <option value="CBA">CBA</option>
              <option value="CITHM">CITHM</option>
              <option value="COECS">COECS</option>
              <option value="LPU-SC">LPU-SC</option>
              <option value="HIGHSCHOOL">HIGHSCHOOL</option>
            </select>
            <label>Department (Required)</label>
          </div>

          <div className="input-label">
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
            >
              <option value="" disabled hidden></option>
              <option value="LMS">LMS</option>
              <option value="Microsoft 365">Microsoft 365</option>
              <option value="STUDENT PORTAL">STUDENT PORTAL</option>
              <option value="ERP">ERP</option>
              <option value="HARDWARE">HARDWARE</option>
              <option value="SOFTWARE">SOFTWARE</option>
              <option value="OTHERS">OTHERS</option>
            </select>
            <label>Category (Required)</label>
          </div>

          <div className="input-label">
            <select
              name="site"
              value={formData.site}
              onChange={handleChange}
              required
            >
              <option value="" disabled hidden></option>
              <option value="Onsite">Onsite</option>
              <option value="Online">Online</option>
            </select>
            <label>Site (Required)</label>
          </div>
          <div className="button-group">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              style={{ display: "none" }}
              accept="*/*"
            />
            <button
              type="button"
              className="add-photo-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
            >
              <Paperclip size={18} />
              Attach Files
            </button>
            <button type="submit" className="submit-btn" disabled={isLoading}>
              {isLoading ? "Submitting..." : "Submit"}
            </button>
          </div>

          {attachments.length > 0 && (
            <div
              style={{
                marginTop: "20px",
                padding: "12px",
                backgroundColor: "#f5f5f5",
                borderRadius: "4px",
              }}
            >
              <p
                style={{
                  margin: "0 0 12px 0",
                  fontWeight: "bold",
                }}
              >
                Attached Files ({attachments.length}):
              </p>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {attachments.map((file, index) => (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 12px",
                      backgroundColor: "white",
                      borderRadius: "4px",
                      border: "1px solid #ddd",
                    }}
                  >
                    <span style={{ fontSize: "14px" }}>
                      {file.name} ({(file.size / 1024).toFixed(2)} KB)
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#d32f2f",
                      }}
                      aria-label="Remove file"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default SubmitTicket;
