import { useState, useRef, useEffect } from "react";
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
  Alert,
} from "../../components/FormFields";

function SubmitTicket() {
  const { showLoading, hideLoading, isLoading } = useLoading();
  const { clearTicketsCache } = useTicketsCache();
  const location = useLocation();
  const chatPrefill = location.state?.chatPrefill;
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    userType: "",
    department: "",
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

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        document.documentElement.style.overflow = "hidden";
        document.body.style.overflow = "hidden";
      } else {
        document.documentElement.style.overflow = "";
        document.body.style.overflow = "";
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
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
    <div className="flex-1 w-full flex flex-col items-center bg-gray-50 p-4 font-poppins overflow-y-auto md:h-screen md:justify-center md:py-4 md:overflow-hidden">
      <div className="w-full max-w-200 h-auto mx-auto px-4 py-6 flex flex-col box-border bg-white rounded-2xl shadow-xl border-t-[6px] border-lpu-maroon md:px-10 md:py-[clamp(1.25rem,3vh,2rem)]">
        <div className="text-center">
          <h1 className="m-0 text-2xl md:text-3xl font-black text-lpu-maroon tracking-tight">
            Submit Ticket
          </h1>
          <p className="text-[0.85rem] text-[#666] my-4 md:my-[clamp(8px,2vh,16px)]">
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

        <Alert type="success" message={successMessage} />
        <Alert type="error" message={errorMessage} />

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-4 w-full md:grid-cols-2"
        >
          <FloatingTextarea
            label="Summary (Required)"
            name="summary"
            value={formData.summary}
            onChange={handleChange}
            heightClass="h-[50px]"
          />

          <FloatingTextarea
            label="Description (Required)"
            name="description"
            value={formData.description}
            onChange={handleChange}
            heightClass="h-[120px] md:h-[clamp(80px,15vh,180px)]"
          />

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

          <AttachmentPreview
            attachments={attachments}
            onRemove={removeAttachment}
          />

          <div className="flex flex-col gap-4 justify-between mt-2 w-full md:flex-row md:justify-end md:col-span-2">
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
