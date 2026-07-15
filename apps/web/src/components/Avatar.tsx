export function Avatar({ pulsing = false }: { pulsing?: boolean }) {
  return (
    <div className={`avatar-orb${pulsing ? " avatar-orb--pulsing" : ""}`} aria-hidden="true">
      <span className="avatar-orb__core" />
    </div>
  );
}
