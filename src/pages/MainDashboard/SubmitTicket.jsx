import { useState } from "react";
import { Paperclip } from "lucide-react";

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Form submitted:", formData);
  };

  return (
    <div className="wrapper">
      <div className="card">
        <h1>Submit Ticket</h1>
        <p>
          Simply create a ticket below. A technician will respond promptly to
          your issue. You may also send tickets directly to
          help@lpul-mis.on.spiceworks.com
        </p>

        <hr className="divider" />
        <form onSubmit={handleSubmit}>
          <div className="input-label">
            <textarea
              name="summary"
              placeholder=" "
              value={formData.summary || ""}
              onChange={handleChange}
              required
            ></textarea>
            <label>Summary(Required)</label>
          </div>

          <div className="input-label">
            <textarea
              name="description"
              placeholder=" "
              value={formData.description}
              onChange={handleChange}
              required
            ></textarea>
            <label>Description(Required)</label>
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
            <label>Type(Required)</label>
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
            <label>Department(Required)</label>
          </div>

          <div className="input-label">
            <select
              name="assignee"
              value={formData.assignee}
              onChange={handleChange}
              required
            >
              <option value="" disabled hidden></option>
              <option value="Support 1">Support 1</option>
              <option value="Support 2">Support 2</option>
              <option value="Support 3">Support 3</option>
            </select>
            <label>Assignee(Required)</label>
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
            <label>Category(Required)</label>
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
            <label>Site(Required)</label>
          </div>
        </form>
        <div className="button-group">
          <button type="button" className="add-photo-btn">
            <Paperclip size={18} />
            Attach Files
          </button>
          <button type="submit" className="submit-btn">
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

export default SubmitTicket;
