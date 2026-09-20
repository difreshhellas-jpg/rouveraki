import clsx from "clsx";

/**
 * Word-by-word reveal for a headline.
 *
 * Rendered on the server as real words in real spans, so the text is in the
 * HTML for search engines and screen readers and there is no flash of
 * unstyled content. The original string stays intact for assistive tech via
 * aria-label; the split spans are hidden from it, because hearing a headline
 * announced one word at a time is worse than hearing it once.
 *
 * 55ms between words, inside the 30-80ms stagger band. Pure CSS: the delay is
 * a custom property and the keyframe does the rest, so nothing here runs on
 * the main thread during the busiest frame of the page load.
 */
export default function StaggerText({
  text,
  className,
  delayMs = 0,
  stepMs = 55,
  as: Tag = "span",
}: {
  text: string;
  className?: string;
  /** Delay before the first word, for sequencing against other elements. */
  delayMs?: number;
  stepMs?: number;
  as?: "h1" | "h2" | "p" | "span";
}) {
  const words = text.split(" ");

  return (
    <Tag className={className} aria-label={text}>
      {words.map((word, i) => (
        <span
          key={`${word}-${i}`}
          aria-hidden="true"
          className="stagger-word"
          style={{ ["--d" as string]: `${delayMs + i * stepMs}ms` }}
        >
          {word}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </Tag>
  );
}

/**
 * Same reveal, one character at a time, for a short wordmark where the words
 * are too few for the stagger to read.
 */
export function StaggerChars({
  text,
  className,
  delayMs = 0,
  stepMs = 38,
}: {
  text: string;
  className?: string;
  delayMs?: number;
  stepMs?: number;
}) {
  return (
    <span className={clsx("inline-block", className)} aria-label={text}>
      {[...text].map((ch, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="stagger-word"
          style={{ ["--d" as string]: `${delayMs + i * stepMs}ms` }}
        >
          {ch === " " ? " " : ch}
        </span>
      ))}
    </span>
  );
}
