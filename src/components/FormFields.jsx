import { forwardRef } from "react";
import { ChevronDown, Paperclip, X } from "lucide-react";

// PrimaryButton: Main action button, typically for form submission
export const PrimaryButton = ({ label, isLoading, icon: Icon, ...props }) => (
  <button
    type="submit"
    disabled={isLoading}
    className="inline-flex justify-center items-center gap-2 bg-lpu-maroon text-white border border-transparent px-8 py-3 rounded-xl cursor-pointer text-[0.95rem] font-bold transition-all duration-200 hover:bg-lpu-gold hover:text-lpu-maroon shadow-lg shadow-lpu-maroon/20 md:w-auto disabled:opacity-50"
    {...props}
  >
    {!isLoading && Icon && <Icon size={18} className="stroke-[2.2px]" />}
    {isLoading ? "Submitting..." : label}
  </button>
);

// SecondaryButton: Outlined button for secondary actions, supports optional icon
export const SecondaryButton = ({
  label,
  onClick,
  icon: Icon,
  disabled,
  ...props
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="inline-flex justify-center items-center gap-2 bg-white text-lpu-maroon border border-lpu-maroon px-8 py-3 rounded-xl cursor-pointer text-[0.95rem] font-bold transition-all duration-200 hover:bg-lpu-maroon hover:text-white hover:border-lpu-maroon md:w-auto disabled:opacity-50"
    {...props}
  >
    {Icon && <Icon size={18} className="stroke-[2.2px]" />}
    {label}
  </button>
);

// FilePicker: Hidden file input with button trigger, uses SecondaryButton
export const FilePicker = forwardRef(({ onFileSelect, isLoading }, ref) => {
  return (
    <>
      <input
        ref={ref}
        type="file"
        multiple
        onChange={onFileSelect}
        className="hidden"
      />
      <SecondaryButton
        label="Attach Files"
        icon={Paperclip}
        onClick={() => ref.current?.click()}
        disabled={isLoading}
      />
    </>
  );
});
FilePicker.displayName = "FilePicker";

// AttachmentPreview: Shows a preview list of attached files with remove option
export const AttachmentPreview = ({ attachments, onRemove }) => {
  if (attachments.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 w-full md:col-span-2 mt-2">
      <p className="text-[0.8rem] font-bold text-gray-500 uppercase tracking-wider px-1">
        Attached Files ({attachments.length})
      </p>
      <div className="flex flex-wrap gap-3">
        {attachments.map((file, index) => {
          const isImage = file.type.startsWith("image/");
          return (
            <div
              key={index}
              className="relative w-24 h-24 border-2 border-lpu-maroon/30 rounded-xl overflow-hidden bg-white shadow-sm"
            >
              {isImage ? (
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="w-full h-full object-cover"
                  onLoad={(e) => URL.revokeObjectURL(e.target.src)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full bg-gray-50 text-gray-400">
                  <Paperclip size={24} className="mb-1" />
                  <span className="text-[10px] font-bold uppercase">
                    {file.name.split(".").pop()}
                  </span>
                </div>
              )}
              {/* Always Visible X */}
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="absolute top-1 right-1 p-1 bg-lpu-maroon text-white rounded-full shadow-md hover:bg-lpu-red z-10 transition-colors"
              >
                <X size={14} strokeWidth={3} />
              </button>
              {/* Always Visible Filename */}
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1.5 py-1 truncate font-medium">
                {file.name}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
// FloatingSelect: Select dropdown with animated floating label
export const FloatingSelect = ({
  label,
  name,
  value,
  onChange,
  options,
  required = true,
}) => {
  const selectClass =
    "w-full appearance-none box-border rounded-xl border border-gray-200 text-[0.95rem] bg-white outline-none transition-all duration-200 focus:ring-2 focus:ring-lpu-gold focus:border-lpu-gold py-[12px] pl-[14px] pr-[36px] cursor-pointer peer";

  const labelClass =
    "absolute left-[14px] top-[12px] text-[0.9rem] text-gray-500 bg-white px-1 transition-all duration-200 pointer-events-none peer-focus:-top-2 peer-focus:text-[0.75rem] peer-focus:font-bold peer-focus:!text-lpu-gold peer-valid:-top-2 peer-valid:text-[0.75rem] peer-valid:font-bold peer-valid:text-gray-500";

  return (
    <div className="relative flex flex-col w-full group">
      <select
        name={name}
        className={selectClass}
        value={value}
        onChange={onChange}
        required={required}
      >
        <option value="" disabled hidden></option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      <label className={labelClass}>{label}</label>
      <ChevronDown
        size={18}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none transition-all duration-200 group-focus-within:rotate-180 peer-focus:text-lpu-gold"
      />
    </div>
  );
};

// FloatingTextarea: Textarea input with animated floating label
export const FloatingTextarea = ({
  label,
  name,
  value,
  onChange,
  heightClass = "h-[50px]",
  required = true,
}) => {
  const textareaClass = `w-full box-border rounded-xl border border-gray-200 text-[0.95rem] bg-white outline-none transition-all duration-200 focus:ring-2 focus:ring-lpu-gold focus:border-lpu-gold px-[14px] py-[12px] peer resize-none ${heightClass}`;

  const labelClass =
    "absolute left-[14px] top-[12px] text-[0.9rem] text-gray-500 bg-white px-1 transition-all duration-200 pointer-events-none peer-focus:-top-2 peer-focus:text-[0.75rem] peer-focus:font-bold peer-focus:!text-lpu-gold peer-[:not(:placeholder-shown)]:-top-2 peer-[:not(:placeholder-shown)]:text-[0.75rem] peer-[:not(:placeholder-shown)]:font-bold peer-[:not(:placeholder-shown)]:text-gray-500";

  return (
    <div className="relative flex flex-col w-full group md:col-span-2">
      <textarea
        name={name}
        placeholder=" "
        className={textareaClass}
        value={value}
        onChange={onChange}
        required={required}
      />
      <label className={labelClass}>{label}</label>
    </div>
  );
};

export const Alert = ({ type, message }) => {
  if (!message) return null;

  const isError = type === "error";

  const classes = isError
    ? "text-lpu-maroon bg-red-50 border-l-lpu-maroon border-red-100"
    : "text-emerald-700 bg-emerald-50 border-l-emerald-500 border-emerald-100";

  return (
    <div
      className={`p-4 mb-6 text-[0.9rem] font-medium rounded-xl border-l-4 border-y border-r shadow-sm transition-all duration-300 ${classes}`}
    >
      <div className="flex items-center gap-2">
        <div
          className={`w-1.5 h-1.5 rounded-full ${isError ? "bg-lpu-maroon" : "bg-emerald-500"}`}
        />
        {message}
      </div>
    </div>
  );
};
