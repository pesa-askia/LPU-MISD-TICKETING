import { useState } from "react";
import { Paperclip } from "lucide-react";
import { supabase } from "../../Supabaseclient";

function SubmitTicket() {
  const [formData, setFormData] = useState({
    userType: "",
    department: "",
    assignee: "",
    category: "",
    description: "",
    summary: "",
    site: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const userId = localStorage.getItem("userId");
      const { data, error } = await supabase
        .from("Tickets")
        .insert([
          {
            Summary: formData.summary,
            Description: formData.description,
            Type: formData.userType,
            Department: formData.department,
            Category: formData.category,
            Site: formData.site,
            created_by: userId || null,
          },
        ])
        .select();

      if (error) {
        console.error("Error submitting ticket:", error);
        setErrorMessage(error.message || "Failed to submit ticket");
      } else {
        console.log("Ticket submitted successfully:", data);
        setSuccessMessage("Ticket submitted successfully! Your ticket has been created.");
        setTimeout(() => setSuccessMessage(null), 5000);

        setFormData({
          userType: "",
          department: "",
          assignee: "",
          category: "",
          description: "",
          summary: "",
          site: "",
        });
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      setErrorMessage("An unexpected error occurred");
    } finally {
      setIsLoading(false);
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
          <div style={{
            backgroundColor: "#ffebee",
            color: "#d32f2f",
            padding: "12px 16px",
            borderRadius: "4px",
            marginBottom: "16px",
            border: "1px solid #ef5350"
          }}>
            <strong>Error:</strong> {errorMessage}
          </div>
        )}
        {successMessage && (
          <div style={{
            backgroundColor: "#e8f5e9",
            color: "#2e7d32",
            padding: "12px 16px",
            borderRadius: "4px",
            marginBottom: "16px",
            border: "1px solid #66bb6a"
          }}>
            <strong>Success:</strong> {successMessage}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="input-label">
            <textarea
              name="summary"
              placeholder=" "
              value={formData.summary || ""}
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
            <button type="button" className="add-photo-btn" disabled={isLoading}>
              <Paperclip size={18} />
              Attach Files
            </button>
            <button type="submit" className="submit-btn" disabled={isLoading}>
              {isLoading ? "Submitting..." : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SubmitTicket;
