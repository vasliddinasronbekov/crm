'use client'

import { Clock, Users } from 'lucide-react'
import { Group } from '@/lib/hooks/useGroups'

// --- Group Card Component for Schedule View ---
interface GroupCardProps {
  group: Group;
  getGroupColor: (group: Group) => string;
  hasConflict: boolean;
  capacityWarning: string | null;
}

export default function GroupCard({ group, getGroupColor, hasConflict, capacityWarning }: GroupCardProps) {
  const groupColor = getGroupColor(group);
  const isOverCapacity = group.room?.capacity && group.students && group.students.length > group.room.capacity;
  const capacityBgColor = isOverCapacity ? 'bg-red-500' : 'bg-orange-500';
  const hasCapacityWarning = capacityWarning !== null;

  const tooltipText = [
    `Group: ${group.name}`,
    `Course: ${group.course?.name || 'N/A'}`,
    `Teacher: ${group.main_teacher?.username || 'N/A'}`,
    `Time: ${group.start_time.slice(0, 5)} - ${group.end_time.slice(0, 5)}`,
    hasConflict ? `
🔴 CONFLICT DETECTED` : '',
    hasCapacityWarning ? `
${isOverCapacity ? '🔴' : '⚠️'} ${capacityWarning}` : ''
  ].filter(Boolean).join('\n');

  return (
    <div
      className={`h-full rounded p-2 flex flex-col justify-between relative overflow-hidden group ${hasConflict ? 'ring-2 ring-red-500' : ''}`}
      style={{
        backgroundColor: `${groupColor}20`,
        borderLeft: `3px solid ${groupColor}`,
      }}
      title={tooltipText}
    >
      {/* Badges */}
      {hasConflict && (
        <div className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold z-10" title="Scheduling Conflict">
          !
        </div>
      )}
      {hasCapacityWarning && !hasConflict && (
        <div className={`absolute top-1 right-1 ${capacityBgColor} text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold z-10`} title={capacityWarning}>
          !
        </div>
      )}

      {/* Collapsed View */}
      <div className="group-hover:hidden transition-opacity duration-200">
        <p className="text-xs font-bold truncate" style={{ color: groupColor }}>{group.name}</p>
        <p className="text-[10px] text-text-secondary truncate">{group.main_teacher?.username || 'No Teacher'}</p>
      </div>

      {/* Expanded View on Hover */}
      <div className="hidden group-hover:block transition-opacity duration-200">
        <p className="text-xs font-bold" style={{ color: groupColor }}>{group.name}</p>
        <p className="text-[11px] text-text-secondary truncate">{group.course?.name || 'N/A'}</p>
        <p className="text-[11px] text-text-secondary truncate">
          <Users className="inline h-3 w-3 mr-1" />
          {group.students?.length || 0}
          {group.room?.capacity ? ` / ${group.room.capacity}` : ''}
        </p>
        <p className="text-[11px] text-text-secondary truncate">
          <Clock className="inline h-3 w-3 mr-1" />
          {group.start_time.slice(0, 5)} - {group.end_time.slice(0, 5)}
        </p>
        <p className="text-[11px] text-text-secondary truncate">
          🚪 {group.room?.name || 'N/A'}
        </p>
      </div>
    </div>
  );
}
