"use client";
import { useState } from "react";
import type { Person } from "@/lib/types";

export function PeoplePicker({ label, people, selected, onChange }: { label: string; people: Person[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const [search, setSearch] = useState("");
  const choices = people.filter(p => `${p.name} ${p.email}`.toLowerCase().includes(search.toLowerCase()));
  return <fieldset className="people-picker"><legend>{label} <span className="optional-label">{selected.length} selected</span></legend>
    <input aria-label={`Search ${label.toLowerCase()}`} placeholder="Search people" value={search} onChange={e => setSearch(e.target.value)} />
    <div className="people-picker-options">{choices.map(p => <label className="check-label" key={p.id}><input type="checkbox" checked={selected.includes(p.id)} onChange={e => onChange(e.target.checked ? [...selected, p.id] : selected.filter(id => id !== p.id))} /><span>{p.name}<small>{p.email}</small></span></label>)}{!choices.length && <p className="field-help">No matching lab members.</p>}</div>
  </fieldset>;
}
