'use client'

import { Group } from '@/lib/hooks/useGroups'

interface UnscheduledGroupsPanelProps {
  groups: Group[];
  onGroupClick: (group: Group) => void;
}

export default function UnscheduledGroupsPanel({ groups, onGroupClick }: UnscheduledGroupsPanelProps) {
  if (groups.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-text-secondary">
        No unscheduled groups.
      </div>
    );
  }

  return (
    <div className="space-y-2 p-2">
      {groups.map(group => (
        <div
          key={group.id}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify(group));
          }}
          onClick={() => onGroupClick(group)}
          className="card p-3 cursor-move hover:bg-background"
        >
          <p className="font-semibold text-sm">{group.name}</p>
          <p className="text-xs text-text-secondary">{group.course?.name || 'No Course'}</p>
        </div>
      ))}
    </div>
  );
}
