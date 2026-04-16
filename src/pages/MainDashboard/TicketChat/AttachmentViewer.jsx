import { Download, X } from "lucide-react";

export default function AttachmentViewer({
  selectedImage,
  onClose,
  getAttachmentSrc,
  onDownload,
}) {
  if (!selectedImage) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: "relative",
          backgroundColor: "white",
          borderRadius: "8px",
          padding: "20px",
          maxWidth: "90vw",
          maxHeight: "90vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            background: "#333",
            color: "white",
            border: "none",
            borderRadius: "50%",
            width: "35px",
            height: "35px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={20} />
        </button>
        <img
          src={getAttachmentSrc(selectedImage)}
          alt={selectedImage.name}
          style={{
            maxWidth: "100%",
            maxHeight: "80vh",
            objectFit: "contain",
          }}
        />
        <div style={{ marginTop: "15px", textAlign: "center" }}>
          <p
            style={{
              margin: "0 0 10px 0",
              fontSize: "14px",
            }}
          >
            {selectedImage.name}
          </p>
          <button
            onClick={() => onDownload(selectedImage)}
            style={{
              padding: "8px 16px",
              fontSize: "14px",
              background: "#2196F3",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              margin: "0 auto",
            }}
          >
            <Download size={16} />
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
