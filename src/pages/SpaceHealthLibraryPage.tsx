import React, { useMemo, useState } from "react";
import { BookOpen, ExternalLink, Search, WifiOff } from "lucide-react";
import { KnowledgeResource } from "../types/aegisContracts";
import { InformationBadge } from "../components/InformationBadge";

interface SpaceHealthLibraryPageProps {
  resources: KnowledgeResource[];
  earthWanConnected: boolean;
}

const LIBRARY_CATEGORIES = [
  "All Categories",
  "Spaceflight hazards",
  "Cardiovascular and physiological risks",
  "Radiation monitoring",
  "Sleep and astronaut well-being",
  "Fluid shift and eye health",
  "Nutrition and hydration",
  "Space research experiments",
];

export const SpaceHealthLibraryPage: React.FC<SpaceHealthLibraryPageProps> = ({
  resources,
  earthWanConnected,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");

  const filteredResources = useMemo(() => {
    return resources.filter((res) => {
      const matchesCat =
        selectedCategory === "All Categories" ||
        (res.category && res.category.toLowerCase() === selectedCategory.toLowerCase());
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        res.title.toLowerCase().includes(q) ||
        res.summary.toLowerCase().includes(q) ||
        res.publisher.toLowerCase().includes(q) ||
        res.topic_tags.some((t) => t.toLowerCase().includes(q));
      return matchesCat && matchesQuery;
    });
  }, [resources, selectedCategory, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header & Offline Availability Banner */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-semibold text-white">
              Space Health Knowledge Library (8 Verified NASA / CSA / HRP Resources)
            </h2>
          </div>
          <InformationBadge type="AI_ASSISTED" />
        </div>

        <p className="text-xs text-slate-400">
          Curated, 100% locally indexed NASA Human Research Program (HRP) and Canadian Space Agency
          (CSA) references. Available offline during deep-space communication blackouts.
        </p>

        {!earthWanConnected && (
          <div className="bg-amber-950/30 border border-amber-500/40 rounded p-3 flex items-center gap-2.5 text-xs text-amber-300 font-mono">
            <WifiOff className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              AUTONOMOUS OFFLINE MODE ACTIVE: Earth WAN is disconnected. All 8 research summaries
              and scope boundary notes are served locally from onboard storage without external
              network calls.
            </span>
          </div>
        )}

        {/* Search Input & Category Filter Bar */}
        <div className="pt-2 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              aria-label="Search Space Health Library"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, publisher, topic tag (e.g., radiation, sleep, SANS, nutrition)..."
              className="w-full bg-slate-950 border border-slate-800 rounded-md pl-9 pr-4 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div
            role="group"
            aria-label="Filter by Research Category"
            className="flex flex-wrap items-center gap-1.5"
          >
            {LIBRARY_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 ${
                    isSelected
                      ? "bg-cyan-500 text-slate-950 border-cyan-400 font-semibold"
                      : "bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Resource Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredResources.map((res) => (
          <article
            key={res.resource_id}
            className="bg-[#111827] border border-slate-800 rounded-lg p-4 flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              {/* Top Metadata Line (Clean unboxed text per design discipline) */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-400">
                <span>
                  {res.resource_id} · {res.publisher} · Date: {res.publication_date}
                </span>
                <span className="text-emerald-300">● {res.review_status}</span>
              </div>

              <h3 className="text-base font-semibold text-white leading-snug">{res.title}</h3>

              <div className="text-xs font-mono text-cyan-400">
                Category: {res.category || "Spaceflight Research"} · Topics:{" "}
                {res.topic_tags.join(" / ")}
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">{res.summary}</p>
            </div>

            <div className="space-y-2.5 pt-3 border-t border-slate-800/80">
              <div className="bg-slate-900/80 border border-slate-800 rounded p-2.5 text-[11px] text-amber-300/90 font-mono">
                Scope Limitation / Evidence Note: {res.evidence_note}
              </div>

              <div className="flex items-center justify-between gap-2 text-xs font-mono">
                <span className="text-slate-400 truncate max-w-xs" title={res.source_url}>
                  {res.source_url}
                </span>
                <a
                  href={res.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 whitespace-nowrap shrink-0 font-semibold"
                >
                  <span>Official Source</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};
