import { ArrowLeft, Bot } from "lucide-react";

export default function ChatHeader({
  adminView,
  creatorName,
  creatorEmail,
  headerInitial,
  adminParticipants,
  isBotTicket,
  onBack,
}) {
  const participants = Array.isArray(adminParticipants)
    ? adminParticipants
    : [];

  return (
    <div className="flex items-center p-3 border-b border-gray-100 bg-white shrink-0">
      <button
        className="p-2 mr-2 rounded-full hover:bg-gray-100 transition-colors shrink-0"
        onClick={onBack}
      >
        <ArrowLeft size={18} className="text-gray-600" />
      </button>

      {/* scrollable carousel for identities */}
      <div className="flex-1 flex flex-nowrap items-center gap-4 overflow-x-auto scrollbar-hide py-1">
        {adminView ? (
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 bg-lpu-maroon text-white rounded-full flex items-center justify-center font-bold text-sm shrink-0">
              {headerInitial || "s"}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-gray-900 truncate text-xs">
                {creatorName}
              </div>
              <div className="text-[10px] text-gray-500 truncate">
                {creatorEmail?.toLowerCase()}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            {isBotTicket && (
              <div className="flex items-center gap-3 shrink-0">
                <div className="w-9 h-9 bg-lpu-maroon text-white rounded-full flex items-center justify-center shrink-0 shadow-inner">
                  <Bot size={18} />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 text-xs">
                    Stella
                  </div>
                  <div className="text-[10px] text-gray-400 truncate">
                    MISD Support Bot
                  </div>
                </div>
              </div>
            )}

            {participants.map((p) => (
              <div key={p.id} className="flex items-center gap-3 shrink-0">
                <div className="w-9 h-9 bg-lpu-maroon/10 text-lpu-maroon rounded-full flex items-center justify-center font-bold border border-lpu-maroon/20 shrink-0 text-sm">
                  {(p.name || "A").trim().charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-xs text-gray-800 truncate">
                    {p.name}
                  </div>
                  <div className="text-[10px] text-gray-400 truncate">
                    {p.email?.toLowerCase()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
