import type { WorkspaceTab } from "../types";

interface TopBarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  onOpenSourceModal: () => void;
}

const NAV_ITEMS: Array<{ id: WorkspaceTab; label: string }> = [
  { id: "studio", label: "Studio" },
  { id: "clips", label: "Clips" },
  { id: "captions", label: "Captions" },
  { id: "export", label: "Export" },
];

export function TopBar({
  activeTab,
  onSelectTab,
  onOpenSourceModal,
}: TopBarProps) {
  return (
    <header className="h-14 shrink-0 border-b border-white/[0.08] bg-[#0B0D11] px-5 lg:px-6 flex items-center justify-between gap-8">
      {/* Zone 1: Single-element display wordmark */}
      <button
        type="button"
        onClick={() => onSelectTab("studio")}
        className="font-display text-lg font-bold tracking-tight text-white hover:text-white/90 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5484D] rounded"
      >
        PeakCut
      </button>

      {/* Zone 2: 4 concise single-line text navigation links */}
      <nav
        aria-label="Workspace views"
        className="hidden sm:flex items-center gap-7 text-sm font-medium"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`relative py-4 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5484D] rounded-sm ${
                isActive
                  ? "text-white"
                  : "text-[#9097A6] hover:text-[#E2E6EE]"
              }`}
            >
              {item.label}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute left-0 right-0 bottom-0 h-[2px] bg-[#E5484D]"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Single primary action */}
      <div className="shrink-0">
        <button
          type="button"
          onClick={onOpenSourceModal}
          className="px-4 py-2 text-xs font-semibold text-white bg-[#E5484D] hover:bg-[#D63B40] active:scale-[0.99] rounded-md transition-all whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5484D] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0D11]"
        >
          New Video
        </button>
      </div>
    </header>
  );
}
