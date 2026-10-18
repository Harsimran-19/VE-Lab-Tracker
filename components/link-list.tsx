"use client";
import { ArrowUpRightIcon } from "@phosphor-icons/react";
import type { ResourceLink } from "@/lib/types";

export function LinkListEditor({ label, links, max, itemName, onChange }: {
  label: string; links: ResourceLink[]; max: number; itemName: string;
  onChange: (links: ResourceLink[]) => void;
}) {
  return <div className="resource-editor">
    <span className="field-label">{label} <span className="optional-label">Optional</span></span>
    {links.map((link, i) => <div className="resource-edit-row" key={i}>
      <label>Name<input required maxLength={150} aria-label={`${itemName} ${i + 1} name`} value={link.label} onChange={e => onChange(links.map((l, j) => j === i ? { ...l, label: e.target.value } : l))} /></label>
      <label>URL<input required type="url" maxLength={2000} placeholder="https://" aria-label={`${itemName} ${i + 1} URL`} value={link.url} onChange={e => onChange(links.map((l, j) => j === i ? { ...l, url: e.target.value } : l))} /></label>
      <button type="button" className="text-action" aria-label={`Remove ${itemName.toLowerCase()} ${link.label || i + 1}`} onClick={() => onChange(links.filter((_, j) => j !== i))}>Remove</button>
    </div>)}
    {links.length < max && <button type="button" className="text-action" onClick={() => onChange([...links, { label: "", url: "" }])}>Add {itemName.toLowerCase()}</button>}
  </div>;
}

export function LinkList({ links }: { links: ResourceLink[] }) {
  return <ul className="resource-list">{links.map((link, i) => <li key={i}><a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}<ArrowUpRightIcon size={15} aria-hidden="true" /></a></li>)}</ul>;
}
