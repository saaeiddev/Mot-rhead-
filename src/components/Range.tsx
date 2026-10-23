import { useId, type CSSProperties } from "react";
export function Range({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = "",
  onChange,
  vertical = false,
  disabled = false,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (n: number) => void;
  vertical?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className={vertical ? "range vertical" : "range"}>
      <div className="range-label">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>
          {value > 0 && unit === "dB" ? "+" : ""}
          {value}
          {unit}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-valuetext={`${value} ${unit}`}
        onChange={(e) => onChange(Number(e.target.value))}
        style={
          {
            "--range": `${((value - min) / (max - min)) * 100}%`,
          } as CSSProperties
        }
      />
    </div>
  );
}
