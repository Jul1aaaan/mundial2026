// Bandera como imagen (flagcdn). En Windows los emoji de bandera no se renderizan,
// por eso usamos imágenes reales a partir del código del país.
const SPECIAL: Record<string, string> = { SCT: "gb-sct", ENG: "gb-eng" };

export default function Flag({ code, size = 22 }: { code: string | null; size?: number }) {
  const width = Math.round((size * 4) / 3);
  if (!code) {
    return (
      <span
        className="inline-block rounded-sm bg-[#dce6e0] shrink-0"
        style={{ width, height: size }}
        aria-hidden
      />
    );
  }
  const c = (SPECIAL[code] ?? code).toLowerCase();
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w40/${c}.png`}
      srcSet={`https://flagcdn.com/w80/${c}.png 2x`}
      width={width}
      height={size}
      alt=""
      loading="lazy"
      className="rounded-sm object-cover shadow-sm shrink-0"
      style={{ width, height: size }}
    />
  );
}
