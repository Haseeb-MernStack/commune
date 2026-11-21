import { memo } from "react";
import { splitLinks } from "@commune/shared";

/**
 * Plain user text with web links turned into real links. Everything else stays text, so nothing a
 * person types can become markup. Links open in a new tab (or the in-app browser sheet when Commune
 * is installed on a phone) and never pass our address on to the other site.
 */
function RichText({ text }: { text: string }) {
  return (
    <>
      {splitLinks(text).map((part, i) =>
        part.type === "text" ? (
          part.value
        ) : (
          <a
            key={i}
            className="rich-link"
            href={part.href}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
            title={part.href}
            // The post card and comments sit inside clickable areas; a link click is only a link click.
            onClick={(e) => e.stopPropagation()}
          >
            {part.label}
          </a>
        ),
      )}
    </>
  );
}

export default memo(RichText);
