import React, { useState } from "react";
import { Image as ImageIcon } from "lucide-react";

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
  caption?: string;
}

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt,
  className = "w-full h-full object-cover",
  fallbackLabel,
  caption,
}) => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="w-full h-full min-h-[120px] bg-gradient-to-br from-sky-50 via-slate-100 to-blue-50 flex flex-col items-center justify-center p-4 text-center text-slate-600">
        <ImageIcon className="w-6 h-6 text-sky-600 mb-1.5" />
        <span className="text-xs font-medium text-slate-700">{fallbackLabel || alt}</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={className}
      />
      {caption && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/75 via-slate-900/30 to-transparent px-3.5 py-2.5 text-[11px] font-medium text-white">
          {caption}
        </div>
      )}
    </div>
  );
};
