import React from "react";
import { BookOpen, ExternalLink } from "lucide-react";
import { CURATED_NASA_CSA_RESOURCES } from "../mocks/cloudPreviewFixtures";
import { retrieveRelevantResources } from "../utils/aegisPureEngine";

interface CuratedReferencesStripProps {
  title: string;
  subtitle?: string;
  topicTags: string[];
  maxItems?: number;
}

export const CuratedReferencesStrip: React.FC<CuratedReferencesStripProps> = ({
  title,
  subtitle = "Verified NASA & CSA spaceflight research references linked to these measurements.",
  topicTags,
  maxItems = 3,
}) => {
  const matched = retrieveRelevantResources(CURATED_NASA_CSA_RESOURCES, topicTags).slice(
    0,
    maxItems
  );
  if (matched.length === 0) return null;

  return (
    <section className="glass-panel rounded-2xl p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-sky-700" />
            <span>{title}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <span className="text-[11px] font-mono text-slate-500">
          Offline Curated Library ({matched.length})
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        {matched.map((ref) => (
          <article
            key={ref.resource_id}
            className="glass-subtle rounded-xl p-3.5 flex flex-col justify-between gap-2.5"
          >
            <div className="space-y-1">
              <div className="text-[11px] text-slate-500">
                {ref.publisher} · {ref.publication_date}
              </div>
              <h3 className="font-semibold text-slate-900 leading-snug">{ref.title}</h3>
              <p className="text-[11px] text-slate-600 leading-relaxed">{ref.evidence_note}</p>
            </div>
            <a
              href={ref.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-800 hover:text-sky-950 font-semibold inline-flex items-center gap-1 pt-1 border-t border-slate-200/70"
            >
              <span>Read source</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </article>
        ))}
      </div>
    </section>
  );
};
