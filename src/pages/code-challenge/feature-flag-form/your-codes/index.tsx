// src/pages/code-challenge/feature-flag-form/your-codes/index.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as ReactForm from "@tanstack/react-form";
import { z } from "zod";
import Editor from "@monaco-editor/react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import "../../../../styles.css"; // adjust path if needed

/* -------------------------
   Zod Schemas
   ------------------------- */
const VariationSchema = z.object({ id: z.string().min(1), value: z.any(), description: z.string().optional() });
const RuleSchema = z.object({
  id: z.string().min(1),
  attribute: z.string().min(1),
  operator: z.enum(["equals", "not_equals", "in", "not_in", "contains"]),
  value: z.any().optional(),
});
const GroupSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    ruleMatch: z.enum(["all", "any"]).default("all"),
    variation: z.string().optional(),
    rules: z.array(RuleSchema).optional(),
    groups: z.array(GroupSchema).optional(),
    // UI helpers (optional in state) - not validated by Zod for export
    expanded: z.boolean().optional(),
    locked: z.boolean().optional(),
  })
);
const FlagSchema = z.object({
  key: z.string().min(1),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  variations: z.array(VariationSchema).min(1),
  defaultVariation: z.string().optional(),
  groups: z.array(GroupSchema).optional(),
});

/* -------------------------
   Helpers & Defaults
   ------------------------- */
const makeId = (prefix = "") => `${prefix}${Math.random().toString(36).slice(2, 9)}`;

const defaultFlag = {
  key: "my-first-flag",
  description: "A sample feature flag",
  enabled: true,
  variations: [
    { id: "Variation_1", value: true, description: "On" },
    { id: "Variation_2", value: false, description: "Off" },
  ],
  defaultVariation: "Variation_1",
  groups: [
    {
      id: makeId("group_"),
      ruleMatch: "all",
      variation: "Variation_1",
      rules: [{ id: makeId("rule_"), attribute: "user.email", operator: "equals", value: "beta@example.com" }],
      groups: [],
      expanded: true,
      locked: false,
    },
  ],
};

/* -------------------------
   Small UI helpers / icons
   ------------------------- */
function IconHandle() {
  return (
    <svg className="w-4 h-4 text-[var(--color-muted-foreground)]" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M10 6h10M10 12h10M10 18h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconCopy() {
  return (
    <svg className="w-4 h-4 inline-block" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 9H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="9" y="3" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconLock({ locked }: { locked: boolean }) {
  return locked ? (
    <svg className="w-4 h-4 text-[var(--color-primary)]" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 17v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 10V8a4 4 0 0 1 8 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg className="w-4 h-4 text-[var(--color-muted-foreground)]" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 10V8a4 4 0 0 1 8 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconChevron({ open }: { open: boolean }) {
  return open ? (
    <svg className="w-4 h-4 text-[var(--color-muted-foreground)]" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 15l6-6 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg className="w-4 h-4 text-[var(--color-muted-foreground)]" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M18 9l-6 6-6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Badge({ children, color = "bg-gray-100 text-gray-800" }: { children: React.ReactNode; color?: string }) {
  return <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${color}`}>{children}</span>;
}

/* -------------------------
   Sortable wrapper
   ------------------------- */
function SortableItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

/* -------------------------
   GroupEditor (recursive) with expand/lock behavior
   ------------------------- */
function GroupEditor({
  group,
  onChange,
  onRemove,
  depth = 0,
}: {
  group: any;
  onChange: (g: any) => void;
  onRemove?: () => void;
  depth?: number;
}) {
  const sensors = useSensors(useSensor(PointerSensor));
  const rulesIds = (group.rules || []).map((r: any) => r.id);
  const groupsIds = (group.groups || []).map((g: any) => g.id);

  // local expanded state falls back to group.expanded; keep in sync
  const [expanded, setExpanded] = useState<boolean>(!!group.expanded);
  const [locked, setLocked] = useState<boolean>(!!group.locked);

  useEffect(() => {
    // sync when parent updates group object
    setExpanded(!!group.expanded);
    setLocked(!!group.locked);
  }, [group.expanded, group.locked]);

  // when expanded changes, propagate to parent unless locked prevents collapse
  useEffect(() => {
    // if locked and expanded is false, force expanded true
    if (locked && !expanded) {
      setExpanded(true);
      return;
    }
    onChange({ ...group, expanded, locked });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, locked]);

  const onDragEndRules = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = rulesIds.indexOf(String(active.id));
    const newIndex = rulesIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const newRules = arrayMove(group.rules || [], oldIndex, newIndex);
    onChange({ ...group, rules: newRules, expanded, locked });
  };

  const onDragEndGroups = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = groupsIds.indexOf(String(active.id));
    const newIndex = groupsIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const newGroups = arrayMove(group.groups || [], oldIndex, newIndex);
    onChange({ ...group, groups: newGroups, expanded, locked });
  };

  // toggle expand/collapse; if locked, prevent collapse
  const toggleExpand = () => {
    if (locked && expanded) return; // locked -> cannot collapse
    setExpanded((s) => !s);
  };

  // toggle lock: when locking, ensure expanded true
  const toggleLock = () => {
    setLocked((l) => {
      const next = !l;
      if (next) setExpanded(true);
      return next;
    });
  };

  return (
    <div className="border rounded-lg p-3 mb-3 bg-[var(--color-card)] shadow-sm" style={{ marginLeft: depth * 12 }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-2">
              <IconHandle />
              <input
                className="text-sm font-medium border-b border-transparent focus:border-[var(--color-ring)] focus:outline-none bg-transparent"
                value={group.id}
                onChange={(e) => onChange({ ...group, id: e.target.value, expanded, locked })}
              />
            </div>

            <div className="ml-3">
              <select
                className="text-xs rounded border px-2 py-1 bg-transparent"
                value={group.ruleMatch || "all"}
                onChange={(e) => onChange({ ...group, ruleMatch: e.target.value, expanded, locked })}
              >
                <option value="all">All</option>
                <option value="any">Any</option>
              </select>
            </div>

            <div>
              <input
                className="text-xs rounded border px-2 py-1 bg-transparent"
                placeholder="Return variation"
                value={group.variation || ""}
                onChange={(e) => onChange({ ...group, variation: e.target.value, expanded, locked })}
              />
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Rules</div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-[var(--color-muted-foreground)] mr-2">drag to reorder</div>

                {/* Expand / Collapse button */}
                <button
                  type="button"
                  onClick={toggleExpand}
                  className="p-1 rounded hover:bg-[var(--color-popover)]"
                  aria-pressed={expanded}
                  title={expanded ? "Collapse group" : "Expand group"}
                >
                  <IconChevron open={expanded} />
                </button>

                {/* Lock button */}
                <button
                  type="button"
                  onClick={toggleLock}
                  className={`p-1 rounded ${locked ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]" : "hover:bg-[var(--color-popover)]"}`}
                  title={locked ? "Locked (will stay expanded)" : "Lock expansion"}
                >
                  <IconLock locked={locked} />
                </button>
              </div>
            </div>

            {/* Only show rules area when expanded */}
            {expanded && (
              <>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEndRules}>
                  <SortableContext items={rulesIds} strategy={verticalListSortingStrategy}>
                    <div className="mt-2 space-y-2">
                      {(group.rules || []).map((r: any, idx: number) => (
                        <SortableItem key={r.id} id={r.id}>
                          <div className="flex gap-2 items-center bg-[var(--color-popover)] rounded p-2">
                            <div className="p-1">
                              <IconHandle />
                            </div>
                            <input
                              className="flex-1 rounded border px-2 py-1 text-sm bg-transparent"
                              value={r.attribute}
                              onChange={(e) => {
                                const newRules = [...(group.rules || [])];
                                newRules[idx] = { ...r, attribute: e.target.value };
                                onChange({ ...group, rules: newRules, expanded, locked });
                              }}
                              placeholder="attribute (e.g., user.email)"
                            />
                            <select
                              className="rounded border px-2 py-1 text-sm bg-transparent"
                              value={r.operator}
                              onChange={(e) => {
                                const newRules = [...(group.rules || [])];
                                newRules[idx] = { ...r, operator: e.target.value };
                                onChange({ ...group, rules: newRules, expanded, locked });
                              }}
                            >
                              <option value="equals">equals</option>
                              <option value="not_equals">not equals</option>
                              <option value="in">in</option>
                              <option value="not_in">not in</option>
                              <option value="contains">contains</option>
                            </select>
                            <input
                              className="rounded border px-2 py-1 text-sm w-36 bg-transparent"
                              value={String(r.value ?? "")}
                              onChange={(e) => {
                                const newRules = [...(group.rules || [])];
                                newRules[idx] = { ...r, value: e.target.value };
                                onChange({ ...group, rules: newRules, expanded, locked });
                              }}
                              placeholder="value"
                            />
                            <button
                              className="text-[var(--color-destructive)] text-sm"
                              onClick={() => {
                                const newRules = (group.rules || []).filter((_, i) => i !== idx);
                                onChange({ ...group, rules: newRules, expanded, locked });
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        </SortableItem>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                <div className="mt-2 flex gap-2">
                  <button
                    className="text-xs bg-[var(--color-primary)] text-[var(--color-primary-foreground)] px-3 py-1 rounded"
                    onClick={() => onChange({ ...group, rules: [...(group.rules || []), { id: makeId("rule_"), attribute: "", operator: "equals", value: "" }], expanded, locked })}
                  >
                    + Rule
                  </button>
                  <button
                    className="text-xs bg-[var(--color-primary)] text-[var(--color-primary-foreground)] px-3 py-1 rounded"
                    onClick={() => onChange({ ...group, groups: [...(group.groups || []), { id: makeId("group_"), ruleMatch: "all", rules: [], groups: [], expanded: true, locked: false }], expanded, locked })}
                  >
                    + Subgroup
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <button className="text-sm text-[var(--color-destructive)]" onClick={() => onRemove && onRemove()}>
            Remove
          </button>
        </div>
      </div>

      <div className="mt-3">
        <div className="text-sm font-medium mb-2">Subgroups</div>
        <DndContext sensors={useSensors(useSensor(PointerSensor))} collisionDetection={closestCenter} onDragEnd={onDragEndGroups}>
          <SortableContext items={groupsIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {(group.groups || []).map((g: any, idx: number) => (
                <SortableItem key={g.id} id={g.id}>
                  <GroupEditor
                    group={g}
                    onChange={(newG) => {
                      const newGroups = [...(group.groups || [])];
                      newGroups[idx] = newG;
                      onChange({ ...group, groups: newGroups, expanded, locked });
                    }}
                    onRemove={() => {
                      const newGroups = (group.groups || []).filter((_, i) => i !== idx);
                      onChange({ ...group, groups: newGroups, expanded, locked });
                    }}
                    depth={depth + 1}
                  />
                </SortableItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}

/* -------------------------
   Utility: create clean export payload
   ------------------------- */
function makeExportPayload(vals: any) {
  const payload: Record<string, any> = { ...vals };
  payload.groups = Array.isArray(vals.groups) ? vals.groups.map((g: any) => cleanGroup(g)) : [];
  payload.variations = Array.isArray(vals.variations) ? vals.variations : [];
  return payload;
}
function cleanGroup(g: any): any {
  const group: any = {
    id: g.id,
    ruleMatch: g.ruleMatch || "all",
    variation: g.variation,
    rules: Array.isArray(g.rules) ? g.rules.map((r: any) => ({ id: r.id, attribute: r.attribute, operator: r.operator, value: r.value })) : [],
    groups: Array.isArray(g.groups) ? g.groups.map((sg: any) => cleanGroup(sg)) : [],
  };
  return group;
}

/* -------------------------
   Main Component
   ------------------------- */
export default function YourCode() {
  const [values, setValues] = useState<any>(defaultFlag);
  const [meta, setMeta] = useState<{ validationErrors?: Record<string, string> | null; lastSaved?: string | null }>({
    validationErrors: null,
    lastSaved: null,
  });

  const formInstanceRef = useRef<any>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => setIsClient(true), []);

  useEffect(() => {
    try {
      if (ReactForm && typeof ReactForm.createForm === "function") {
        const f = ReactForm.createForm({ initialValues: values });
        formInstanceRef.current = f;
        if (typeof f.subscribe === "function") {
          f.subscribe(({ values: fv }: any) => setValues((old: any) => ({ ...old, ...fv })));
        }
      } else {
        formInstanceRef.current = null;
      }
    } catch {
      formInstanceRef.current = null;
    }
    return () => {
      try {
        formInstanceRef.current?.destroy?.();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setPatch = (patch: Partial<any>) => {
    setValues((old: any) => ({ ...old, ...patch }));
    try {
      formInstanceRef.current?.setValues?.((old: any) => ({ ...old, ...patch }));
    } catch {}
  };

  const addVariation = () => {
    const v = { id: `Variation_${(values.variations || []).length + 1}`, value: "", description: "" };
    setValues((old: any) => ({ ...old, variations: [...(old.variations || []), v] }));
  };

  const removeVariation = (idx: number) => {
    setValues((old: any) => ({ ...old, variations: (old.variations || []).filter((_: any, i: number) => i !== idx) }));
  };

  const addGroup = () => {
    const g = { id: makeId("group_"), ruleMatch: "all", rules: [], groups: [], expanded: true, locked: false };
    setValues((old: any) => ({ ...old, groups: [...(old.groups || []), g] }));
  };

  const validateAndSet = async (vals: any) => {
    try {
      FlagSchema.parse(vals);
      setMeta((m) => ({ ...m, validationErrors: null }));
      return { success: true };
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        for (const e of err.errors) {
          const path = e.path.length ? e.path.join(".") : "_root";
          errors[path] = e.message;
        }
        setMeta((m) => ({ ...m, validationErrors: errors }));
        return { success: false, errors };
      }
      throw err;
    }
  };

  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const res = await validateAndSet(values);
    if (!res.success) return;
    const payload = makeExportPayload(values);
    console.log("Saved flag payload:", payload);
    setMeta((m) => ({ ...m, lastSaved: new Date().toISOString() }));
  };

  const copyJSON = async () => {
    try {
      const payload = makeExportPayload(values);
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      // eslint-disable-next-line no-alert
      alert("JSON copied to clipboard");
    } catch {
      // eslint-disable-next-line no-alert
      alert("Copy failed");
    }
  };

  const jsonPreview = useMemo(() => {
    try {
      return JSON.stringify(makeExportPayload(values), null, 2);
    } catch {
      return "{}";
    }
  }, [values, meta]);

  const validationErrors = meta.validationErrors || {};

  return (
    <section className="min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)] font-sans p-6">
      <div className="max-w-7xl mx-auto grid grid-cols-12 gap-6">
        {/* Left: Editor */}
        <div className="col-span-7">
          <div className="bg-[var(--color-card)] rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
                  Feature Flag Editor
                </h1>
                <p className="text-sm text-[var(--color-muted-foreground)]">Design flags, variations and targeting rules — preview JSON live.</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={copyJSON} type="button" className="flex items-center gap-2 bg-[var(--color-popover)] px-3 py-2 rounded text-sm hover:opacity-90">
                  <IconCopy /> Copy JSON
                </button>
                <button onClick={onSubmit} type="button" className="bg-[var(--color-primary)] text-[var(--color-primary-foreground)] px-4 py-2 rounded text-sm">
                  Save
                </button>
                <button
                  onClick={() => {
                    setValues(defaultFlag);
                    setMeta({ validationErrors: null, lastSaved: null });
                    try {
                      formInstanceRef.current?.setValues?.(defaultFlag);
                    } catch {}
                  }}
                  type="button"
                  className="bg-[var(--color-popover)] px-3 py-2 rounded text-sm"
                >
                  Reset
                </button>
              </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-[var(--color-muted-foreground)]">Flag Key</label>
                  <input className="mt-1 block w-full rounded border px-3 py-2 bg-[var(--color-card)]" value={values.key} onChange={(e) => setPatch({ key: e.target.value })} />
                  {validationErrors["key"] && <div className="text-sm text-[var(--color-destructive)] mt-1">{validationErrors["key"]}</div>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-muted-foreground)]">Enabled</label>
                  <div className="mt-1">
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={values.enabled} onChange={(e) => setPatch({ enabled: e.target.checked })} className="form-checkbox h-5 w-5" />
                      <span className="text-sm">{values.enabled ? "Enabled" : "Disabled"}</span>
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-muted-foreground)]">Description</label>
                <textarea className="mt-1 block w-full rounded border px-3 py-2 bg-[var(--color-card)]" rows={2} value={values.description || ""} onChange={(e) => setPatch({ description: e.target.value })} />
              </div>

              <div className="bg-[var(--color-popover)] p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium">Variations</h3>
                    <p className="text-xs text-[var(--color-muted-foreground)]">Define possible return values</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={addVariation} className="text-sm bg-[var(--color-primary)] text-[var(--color-primary-foreground)] px-3 py-1 rounded">
                      + Add
                    </button>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {(values.variations || []).map((v: any, idx: number) => (
                    <div key={v.id} className="flex items-center gap-2 bg-[var(--color-card)] p-2 rounded shadow-sm">
                      <div className="w-6">
                        <Badge color="bg-indigo-100 text-indigo-800">{idx + 1}</Badge>
                      </div>
                      <input
                        className="w-36 rounded border px-2 py-1 text-sm bg-[var(--color-card)]"
                        value={v.id}
                        onChange={(e) => {
                          const newVars = [...(values.variations || [])];
                          newVars[idx] = { ...v, id: e.target.value };
                          setPatch({ variations: newVars });
                        }}
                      />
                      <input
                        className="flex-1 rounded border px-2 py-1 text-sm bg-[var(--color-card)]"
                        value={String(v.value ?? "")}
                        onChange={(e) => {
                          const newVars = [...(values.variations || [])];
                          let parsed: any = e.target.value;
                          try {
                            parsed = JSON.parse(e.target.value);
                          } catch {
                            parsed = e.target.value;
                          }
                          newVars[idx] = { ...v, value: parsed };
                          setPatch({ variations: newVars });
                        }}
                        placeholder='value (e.g., true, false, "blue")'
                      />
                      <input
                        className="w-48 rounded border px-2 py-1 text-sm bg-[var(--color-card)]"
                        value={v.description || ""}
                        onChange={(e) => {
                          const newVars = [...(values.variations || [])];
                          newVars[idx] = { ...v, description: e.target.value };
                          setPatch({ variations: newVars });
                        }}
                        placeholder="description"
                      />
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" name="defaultVariation" checked={values.defaultVariation === v.id} onChange={() => setPatch({ defaultVariation: v.id })} />
                        <span className="text-xs text-[var(--color-muted-foreground)]">Default</span>
                      </label>
                      <button className="text-[var(--color-destructive)]" onClick={() => removeVariation(idx)} type="button">
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                {validationErrors["variations"] && <div className="text-sm text-[var(--color-destructive)] mt-2">{validationErrors["variations"]}</div>}
              </div>

              <div className="bg-[var(--color-card)] p-4 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium">Targeting Rules</h3>
                    <p className="text-xs text-[var(--color-muted-foreground)]">Groups are recursive. Rules inside groups determine targeting.</p>
                  </div>
                  <div>
                    <button type="button" onClick={addGroup} className="text-sm bg-[var(--color-primary)] text-[var(--color-primary-foreground)] px-3 py-1 rounded">
                      + Add Group
                    </button>
                  </div>
                </div>

                <div className="mt-3 space-y-3">
                  {(values.groups || []).map((g: any, idx: number) => (
                    <GroupEditor
                      key={g.id}
                      group={g}
                      onChange={(newG) => {
                        const newGroups = [...(values.groups || [])];
                        newGroups[idx] = newG;
                        setPatch({ groups: newGroups });
                      }}
                      onRemove={() => {
                        const newGroups = (values.groups || []).filter((_, i) => i !== idx);
                        setPatch({ groups: newGroups });
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button type="submit" className="bg-[var(--color-primary)] text-[var(--color-primary-foreground)] px-4 py-2 rounded">
                  Save Flag
                </button>
                <button
                  type="button"
                  className="bg-[var(--color-popover)] px-4 py-2 rounded"
                  onClick={() => {
                    setValues(defaultFlag);
                    setMeta({ validationErrors: null, lastSaved: null });
                    try {
                      formInstanceRef.current?.setValues?.(defaultFlag);
                    } catch {}
                  }}
                >
                  Reset
                </button>
                <div className="ml-auto text-sm text-[var(--color-muted-foreground)]">{meta.lastSaved && <span>Last saved: {meta.lastSaved}</span>}</div>
              </div>

              {Object.keys(validationErrors).length > 0 && (
                <div className="mt-2 text-sm text-[var(--color-destructive)]">
                  <strong>Validation errors:</strong>
                  <ul className="list-disc ml-5">
                    {Object.entries(validationErrors).map(([k, errMsg]) => (
                      <li key={k}>
                        <span className="font-medium">{k}</span>: {errMsg}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Right: JSON Preview (client-only Monaco) */}
        <div className="col-span-5">
          <div className="bg-[var(--color-card)] rounded-lg shadow p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-medium">JSON Preview</h3>
                <p className="text-xs text-[var(--color-muted-foreground)]">Live preview of the flag configuration</p>
              </div>
              <div className="text-xs text-[var(--color-muted-foreground)]">Read-only</div>
            </div>

            <div className="flex-1 border rounded overflow-hidden">
              {isClient ? (
                <Editor height="100%" defaultLanguage="json" value={jsonPreview} options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12 }} />
              ) : (
                <pre className="p-4 text-xs text-[var(--color-muted-foreground)] overflow-auto h-full">{jsonPreview}</pre>
              )}
            </div>

            <div className="mt-3 text-xs text-[var(--color-muted-foreground)]">Use this JSON to import into your feature flag system.</div>
          </div>
        </div>
      </div>
    </section>
  );
}
