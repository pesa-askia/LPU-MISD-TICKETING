import { X } from "lucide-react";

export default function AttachmentViewer({
  selectedImage,
  onClose,
  getAttachmentSrc,
}) {
  if (!selectedImage) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/95 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Floating Close Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute right-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/70 transition-all hover:bg-white/20 hover:text-white sm:right-6 sm:top-6"
        aria-label="Close viewer"
      >
        <X size={24} />
      </button>

      {/* Fullscreen Image Container */}
      <div className="flex h-full w-full items-center justify-center p-2 sm:p-8">
        <img
          src={getAttachmentSrc(selectedImage)}
          alt="Fullscreen view"
          className="max-h-full max-w-full object-contain shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}
