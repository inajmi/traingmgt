export type FieldDef = {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "number" | "date";
  options?: string[];
};

const common = "field";

export function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (key: string, val: string | number | null) => void;
}) {
  const v = (value ?? "") as string | number;

  if (field.type === "select") {
    return (
      <select value={String(v)} onChange={(e) => onChange(field.key, e.target.value)} className={common}>
        {field.options!.map((o) => (
          <option key={o} value={o}>{o === "" ? "— Select —" : o}</option>
        ))}
      </select>
    );
  }
  if (field.type === "textarea") {
    return (
      <textarea
        value={String(v)}
        maxLength={4000}
        rows={3}
        onChange={(e) => onChange(field.key, e.target.value)}
        className={common}
      />
    );
  }
  if (field.type === "number") {
    return (
      <input
        type="number"
        min={0}
        max={99}
        value={v === null || v === "" ? "" : Number(v)}
        onChange={(e) => onChange(field.key, e.target.value === "" ? null : Number(e.target.value))}
        className={common}
      />
    );
  }
  if (field.type === "date") {
    return <input type="date" value={String(v)} onChange={(e) => onChange(field.key, e.target.value)} className={common} />;
  }
  return <input type="text" value={String(v)} maxLength={500} onChange={(e) => onChange(field.key, e.target.value)} className={common} />;
}

export function FieldGroup({ field, value, onChange, span2 }: {
  field: FieldDef;
  value: unknown;
  onChange: (key: string, val: string | number | null) => void;
  span2?: boolean;
}) {
  return (
    <div className={field.type === "textarea" || span2 ? "sm:col-span-2" : ""}>
      <label className="label">{field.label}</label>
      <FieldInput field={field} value={value} onChange={onChange} />
    </div>
  );
}