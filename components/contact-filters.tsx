"use client";

import { Input, Select } from "@/components/ui/field";
import { PRIORITIES, SORT_FIELDS, type SortField } from "@/lib/validation";

const SORT_LABELS: Record<SortField, string> = {
  name: "Name",
  company: "Company",
  priority: "Priority",
  created_at: "Date added",
};

export type Filters = {
  search: string;
  priority: string;
  sort: SortField;
  direction: "asc" | "desc";
};

export function ContactFilters({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (next: Partial<Filters>) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="sm:col-span-2 lg:col-span-1">
        <label htmlFor="search" className="sr-only">
          Search contacts
        </label>
        <Input
          id="search"
          type="search"
          value={filters.search}
          onChange={(event) => onChange({ search: event.target.value })}
          placeholder="Search name, company, role…"
        />
      </div>

      <div>
        <label htmlFor="priority-filter" className="sr-only">
          Filter by priority
        </label>
        <Select
          id="priority-filter"
          value={filters.priority}
          onChange={(event) => onChange({ priority: event.target.value })}
        >
          <option value="all">All priorities</option>
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {priority.charAt(0).toUpperCase() + priority.slice(1)} priority
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label htmlFor="sort-field" className="sr-only">
          Sort by
        </label>
        <Select
          id="sort-field"
          value={filters.sort}
          onChange={(event) => onChange({ sort: event.target.value as SortField })}
        >
          {SORT_FIELDS.map((field) => (
            <option key={field} value={field}>
              Sort by {SORT_LABELS[field].toLowerCase()}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label htmlFor="sort-direction" className="sr-only">
          Sort direction
        </label>
        <Select
          id="sort-direction"
          value={filters.direction}
          onChange={(event) =>
            onChange({ direction: event.target.value as "asc" | "desc" })
          }
        >
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </Select>
      </div>
    </div>
  );
}
