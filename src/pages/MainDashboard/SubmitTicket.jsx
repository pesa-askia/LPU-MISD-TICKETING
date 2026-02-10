import { useState } from "react";

function SubmitTicket() {
  const [formData, setFormData] = useState({
    userType: "",
    department: "",
    assignee: "",
    category: "",
    description: "",
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
        <form onSubmit={handleSubmit}>
          <select
            name="userType"
            value={formData.userType}
            onChange={handleChange}
            required
          >
            <option value="" disabled selected hidden>Are you a---</option>
            <option value="STUDENT">STUDENT</option>
            <option value="FACULTY">FACULTY</option>
            <option value="ADMIN">ADMIN</option>
          </select>

          <select
            name="department"
            value={formData.department}
            onChange={handleChange}
            required
          >
            <option value="" disabled selected hidden>Department</option>
            <option value="CAS">CAHS</option>
            <option value="CBA">CBA</option>
            <option value="CITHM">CITHM</option>
            <option value="COECS">COECS</option>
            <option value="LPU-SC">LPU-SC</option>
            <option value="HIGHSCHOOL">HIGHSCHOOL</option>
          </select>

          <select
            name="assignee"
            value={formData.assignee}
            onChange={handleChange}
            required
          >
            <option value="" disabled selected hidden>Assignee</option>
            <option value="Support 1">Support 1</option>
            <option value="Support 2">Support 2</option>
            <option value="Support 3">Support 3</option>
          </select>

          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            required
          >
            <option value="" disabled selected hidden>Category</option>
            <option value="LMS">LMS</option>
            <option value="Microsoft 365">Microsoft 365</option>
            <option value="STUDENT PORTAL">STUDENT PORTAL</option>
            <option value="ERP">ERP</option>
            <option value="HARDWARE">HARDWARE</option>
            <option value="SOFTWARE">SOFTWARE</option>
            <option value="OTHERS">OTHERS</option>
          </select>

          <textarea
            name="description"
            placeholder="Description"
            value={formData.description}
            onChange={handleChange}
            required
          ></textarea>

          <div className="button-group">
            <button type="button" className="add-photo-btn">Add Photo</button>
            <button type="submit" className="submit-btn">Submit</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SubmitTicket;