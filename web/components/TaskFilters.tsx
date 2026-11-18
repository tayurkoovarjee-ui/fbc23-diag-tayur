'use client';

import { STATUS_LABELS, type ListFilters, type Status } from '@/lib/api';

interface Props {
  filters: ListFilters;
  onChange: (patch: Partial<ListFilters>) => void;
}

export default function TaskFilters({ filters, onChange }: Props) {
  return (
    <div className="filters">
      <div className="field">
        <label htmlFor="filter-status">Show</label>
        <select
          id="filter-status"
          value={filters.status}
          onChange={(e) => onChange({ status: e.target.value as Status | '' })}
        >
          <option value="">All statuses</option>
          {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="filter-search">Search</label>
        <input
          id="filter-search"
          type="search"
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
          placeholder="Title or description"
        />
      </div>

      <div className="field">
        <label htmlFor="filter-sort">Sort by</label>
        <select
          id="filter-sort"
          value={`${filters.sort}:${filters.order}`}
          onChange={(e) => {
            const [sort, order] = e.target.value.split(':') as [ListFilters['sort'], ListFilters['order']];
            onChange({ sort, order });
          }}
        >
          <option value="createdAt:desc">Newest first</option>
          <option value="createdAt:asc">Oldest first</option>
          <option value="dueDate:asc">Due soonest</option>
          <option value="dueDate:desc">Due latest</option>
          <option value="title:asc">Title A to Z</option>
          <option value="status:asc">Status</option>
        </select>
      </div>
    </div>
  );
}
