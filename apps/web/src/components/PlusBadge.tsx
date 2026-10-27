/** Small ✦ mark shown next to the name of a Commune Plus member. */
export default function PlusBadge({ plus }: { plus: boolean }) {
  if (!plus) return null;
  return (
    <span className="plus-badge" title="Commune Plus member" aria-label="Commune Plus member">
      ✦
    </span>
  );
}
