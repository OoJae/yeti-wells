import { useState } from "react";
import { Droplets } from "lucide-react";
import { walrusBlobUrl } from "../config";

/**
 * FE-07: render a Walrus cover image safely. The blob id is attacker-influenced (campaign creators), so
 * on a missing/broken/non-image blob we fall back to a placeholder instead of a broken-image icon. The
 * backend only accepts raster covers (PNG/JPEG/GIF/WebP), so this is always loaded as an <img> (no SVG/script).
 */
export function CoverImage({ blobId, alt, className }: { blobId: string; alt: string; className?: string }) {
  const [err, setErr] = useState(false);
  if (!blobId || err) {
    return (
      <div className={`flex items-center justify-center bg-secondary text-sui/40 ${className ?? ""}`}>
        <Droplets className="h-10 w-10" />
      </div>
    );
  }
  return (
    <img
      src={walrusBlobUrl(blobId)}
      alt={alt}
      loading="lazy"
      onError={() => setErr(true)}
      className={`object-cover ${className ?? ""}`}
    />
  );
}
