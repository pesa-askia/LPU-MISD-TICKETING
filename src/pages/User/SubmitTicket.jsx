import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { Paperclip, X, ChevronDown, Send } from "lucide-react";
import { jwtDecode } from "jwt-decode";
import { useLocation } from "react-router-dom";
import { realtimeSupabase } from "../../lib/realtimeSupabaseClient";
import { useLoading } from "../../context/LoadingContext";
import { useTicketsCache } from "../../context/TicketsCacheContext";
import {
  PrimaryButton,
  FilePicker,
  AttachmentPreview,
  FloatingSelect,
  FloatingTextarea,
  FloatingInput,
  Alert,
} from "../../components/FormFields";

function SubmitTicket() {
  const { showLoading, hideLoading, isLoading } = useLoading();
  const { clearTicketsCache } = useTicketsCache();
  const location = useLocation();
  const chatPrefill = location.state?.chatPrefill;
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    userType: localStorage.getItem("userType") || "",
    department: localStorage.getItem("userDepartment") || "",
    category: "",
    description: chatPrefill?.description || "",
    summary: chatPrefill?.summary || "",
    site: "",
  });
  const [attachments, setAttachments] = useState([]);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // When navigating to this page from the chatbot while already on it,
  // the component doesn't remount so useState initializer won't re-run.
  useEffect(() => {
    if (chatPrefill) {
      setFormData((prev) => ({
        ...prev,
        summary: chatPrefill.summary || prev.summary,
        description: chatPrefill.description || prev.description,
      }));
    }
  }, [chatPrefill]);

  useLayoutEffect(() => {
    const mainEl = document.querySelector("main");
    if (!mainEl) return;
    mainEl.style.overflowY = "hidden";
    return () => { mainEl.style.overflowY = ""; };
  }, []);

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
          },
        ])
        .select("id");

      if (error) throw error;

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
              ticket_owner_id: userId,
              attachments:
                attachmentData.length > 0
                  ? JSON.stringify(attachmentData)
                  : null,
            },
          ]);

        if (messageError) {
          setErrorMessage(
            "Ticket created, but initial message failed to post.",
          );
        }
      }

      clearTicketsCache();

      setSuccessMessage(
        "Ticket submitted successfully! Our technicians will review it shortly.",
      );

      setTimeout(() => setSuccessMessage(null), 5000);

      setFormData({
        userType: localStorage.getItem("userType") || "",
        department: localStorage.getItem("userDepartment") || "",
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
    <div className="w-full min-h-full flex flex-col items-center justify-center p-4 bg-gray-50 font-poppins">
      <div className="w-full max-w-200 mx-auto px-2 py-6 flex flex-col box-border bg-white rounded-2xl shadow-xl border-t-[6px] border-lpu-maroon overflow-hidden lg:px-8 lg:py-[clamp(1.25rem,3vh,2rem)]">
        <div className="text-center shrink-0">
          <h1 className="m-0 text-2xl lg:text-3xl font-black text-lpu-maroon tracking-tight">
            Submit Ticket
          </h1>
          <p className="text-[0.85rem] text-[#666] my-4 lg:my-[clamp(8px,2vh,16px)]">
            Create a ticket below and a technician will respond promptly to your
            issue. You may also email directly to &nbsp;
            <a
              href="mailto:help@lpul-mis.on.spiceworks.com"
              className="text-lpu-maroon font-semibold hover:underline"
            >
              help@lpul-mis.on.spiceworks.com
            </a>
          </p>
        </div>

        <div className="shrink-0">
          <Alert type="success" message={successMessage} />
          <Alert type="error" message={errorMessage} />
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col"
        >
          <div className="overflow-y-auto overflow-x-hidden flex flex-col gap-4 pt-3 pb-2 px-2 max-h-[55vh] lg:max-h-[65vh]">
            <FloatingInput
              label="Summary (Required)"
              name="summary"
              value={formData.summary}
              onChange={handleChange}
              required
            />

            <FloatingTextarea
              label="Description (Required)"
              name="description"
              value={formData.description}
              onChange={handleChange}
              heightClass="min-h-[72px]"
              autoResize
            />

            <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2">
              <FloatingSelect
                label="Type (Required)"
                name="userType"
                value={formData.userType}
                onChange={handleChange}
                options={["Student", "Faculty", "Admin"]}
              />

              <FloatingSelect
                label="Department (Required)"
                name="department"
                value={formData.department}
                onChange={handleChange}
                options={["CAS", "CBA", "CITHM", "COECS", "LPU-SC", "Highschool"]}
              />

              <FloatingSelect
                label="Category (Required)"
                name="category"
                value={formData.category}
                onChange={handleChange}
                options={[
                  "ERP",
                  "LMS",
                  "Student Portal ",
                  "Microsoft 365",
                  "Hardware",
                  "Software",
                  "Others",
                ]}
              />

              <FloatingSelect
                label="Site (Required)"
                name="site"
                value={formData.site}
                onChange={handleChange}
                options={["Onsite", "Online"]}
              />
            </div>

            <AttachmentPreview
              attachments={attachments}
              onRemove={removeAttachment}
            />
          </div>

          <div className="shrink-0 flex flex-col gap-4 justify-between mt-2 w-full lg:flex-row lg:justify-end">
            <FilePicker
              ref={fileInputRef}
              onFileSelect={handleFileSelect}
              isLoading={isLoading}
            />
            <PrimaryButton
              label="Submit Ticket"
              isLoading={isLoading}
              icon={Send}
            />
          </div>
        </form>
      </div>
    </div>
  );
}

export default SubmitTicket;
