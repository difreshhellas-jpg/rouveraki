import { Fragment } from "react";
import clsx from "clsx";

/**
 * Endless strip of short brand phrases.
 *
 * The track is rendered twice and the pair translates by exactly -50%, so the
 * second copy lands where the first began and the loop has no seam. Duplicating
 * the content is what makes that possible; a single track would snap back.
 *
 * `aria-hidden` on the duplicate, so the phrases are announced once. The whole
 * strip is decorative reinforcement, never the only place a fact appears.
 *
 * Pauses on hover so a phrase can actually be read, and holds still entirely
 * under reduced motion (globals.css).
 */
export default function Marquee({
  items,
  className,
}: {
  items: string[];
  className?: string;
}) {
  const Track = ({ hidden }: { hidden?: boolean }) => (
    <div
      className="flex shrink-0 items-center"
      aria-hidden={hidden ? "true" : undefined}
    >
      {items.map((item, i) => (
        <Fragment key={`${item}-${i}`}>
          <span className="px-6 py-3 text-sm font-medium tracking-wide text-onband/70 sm:px-8">
            {item}
          </span>
          <span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-accent/60" />
        </Fragment>
      ))}
    </div>
  );

  return (
    <div className={clsx("marquee border-y border-onband/10 bg-band", className)}>
      <div className="marquee__inner">
        <Track />
        <Track hidden />
      </div>
    </div>
  );
}
