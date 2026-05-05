import { Smile, Frown, CheckCircle2 } from "lucide-react";
import { useState } from "react";

/**
 * Modal — generic reusable modal shell.
 *
 * Props:
 *   header    – ReactNode rendered in the header bar (optional)
 *   children  – modal body content
 *   className – extra classes on the inner card (optional)
 */
export function Modal({ header, children, className = "" }) {
  return (
    /*
     * z-1200 clears SidePanel (z-[1001]) and toggle handle (z-1002).
     * pb-18 on mobile offsets the bottom nav (~70px) so flex centering
     * visually lands in the space above the nav bar.
     */
    <div className="fixed inset-0 z-1200 flex items-center justify-center p-4 pb-18 md:pb-4 bg-black/50 backdrop-blur-sm">
      <div
        className={`w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden font-poppins border-t-[6px] border-lpu-maroon ${className}`}
      >
        {header && (
          <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-gray-100">
            {header}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/**
 * FeedbackModal — ticket close satisfaction survey. Composed from Modal.
 *
 * Props:
 *   ticket   – closed ticket object { id, Summary, Description, Category }
 *   onSubmit – fn(satisfied: boolean) called on selection
 *   onClose  – fn() called 2s after selection (auto-close)
 */
export function FeedbackModal({ ticket, onSubmit, onClose }) {
  const [submitted, setSubmitted] = useState(false);
  const [satisfied, setSatisfied] = useState(null);

  const handleSelect = (val) => {
    setSatisfied(val);
    setSubmitted(true);
    onSubmit?.(val);
    setTimeout(() => onClose?.(), 2000);
  };

  const header = (
    <>
      <div className="flex items-center gap-2.5 min-w-0">
        <CheckCircle2 size={20} className="shrink-0 text-lpu-maroon" />
        <h2 className="text-lpu-maroon font-black text-lg tracking-tight leading-tight">
          Ticket Closed
        </h2>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {ticket.Category && (
          <span className="text-sm font-bold text-lpu-maroon bg-lpu-maroon/10 border border-lpu-maroon/20 px-2.5 py-1 rounded-full tracking-tight">
            {ticket.Category}
          </span>
        )}
        <span className="bg-lpu-maroon text-white text-sm font-black px-2.5 py-1 rounded-full">
          #{ticket.id}
        </span>
      </div>
    </>
  );

  return (
    <Modal header={header}>
      {/* Ticket info */}
      <div className="px-5 pt-4 pb-3 border-b border-gray-100">
        <p className="text-gray-800 font-bold text-base leading-snug line-clamp-2 mb-1.5">
          {ticket.Summary}
        </p>
        {ticket.Description && (
          <p className="text-gray-400 text-sm leading-relaxed line-clamp-3">
            {ticket.Description}
          </p>
        )}
      </div>

      {/* Feedback area */}
      <div className="px-5 py-4">
        {!submitted ? (
          <>
            <p className="text-gray-600 font-semibold text-base text-center mb-4">
              Were you satisfied with the resolution?
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleSelect(true)}
                className="flex-1 flex flex-col items-center gap-2.5 py-4 rounded-xl border-2 border-gray-200 hover:border-green-500 hover:bg-green-50 active:scale-95 transition-all duration-200 group cursor-pointer"
              >
                <Smile
                  size={36}
                  className="text-gray-300 group-hover:text-green-500 transition-colors duration-200"
                />
                <span className="text-sm font-bold text-gray-400 group-hover:text-green-600 transition-colors duration-200">
                  Satisfied
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSelect(false)}
                className="flex-1 flex flex-col items-center gap-2.5 py-4 rounded-xl border-2 border-gray-200 hover:border-lpu-red hover:bg-red-50 active:scale-95 transition-all duration-200 group cursor-pointer"
              >
                <Frown
                  size={36}
                  className="text-gray-300 group-hover:text-lpu-red transition-colors duration-200"
                />
                <span className="text-sm font-bold text-gray-400 group-hover:text-lpu-red transition-colors duration-200">
                  Not Satisfied
                </span>
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-2">
            {satisfied ? (
              <Smile size={48} className="text-green-500" />
            ) : (
              <Frown size={48} className="text-lpu-red" />
            )}
            <p className="text-lpu-maroon font-black text-lg">
              Thank you for your feedback!
            </p>
            <p className="text-gray-400 text-base">
              {satisfied ? "Glad we could help." : "We'll work to improve."}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

/**
 * KnowledgeEntryModal — Add / Edit knowledge entry modal. Composed from Modal.
 *
 * Props:
 *   title    – header title string
 *   icon     – Lucide icon component
 *   children – form body content
 */
export function KnowledgeEntryModal({ title, icon: Icon, onClose, children }) {
  const header = (
    <>
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && <Icon size={20} className="shrink-0 text-lpu-maroon" />}
        <h2 className="text-lpu-maroon font-black text-lg tracking-tight leading-tight truncate">
          {title}
        </h2>
      </div>
    </>
  );

  return (
    <Modal header={header} className="max-w-lg">
      {children}
    </Modal>
  );
}
