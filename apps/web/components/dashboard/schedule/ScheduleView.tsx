'use client'

import { useState, useEffect } from 'react'
import { Group } from '@/lib/hooks/useGroups'
import GroupCard from './GroupCard'
import { Calendar } from 'lucide-react'
import { parseGroupDays, WEEK_DAYS, type WeekDay } from '@/lib/utils/schedule'

// --- Schedule View Component ---
interface ScheduleViewProps {
    groups: Group[]
    onReschedule: (groupId: number, newDay: string, newTime: string) => void
    onGroupClick: (group: Group) => void
    onDuplicateGroup: (group: Group, targetDays: string[]) => void
    getGroupColor: (group: Group) => string
    detectConflicts: (group: Group, day: string, hour: number) => string[]
    detectCapacityWarning: (group: Group) => string | null
    showConflicts: boolean
    startHour: number
    endHour: number
    currentWeekOffset: number
    weekRange: { start: Date; end: Date }
    swimlaneBy: 'none' | 'teacher' | 'room'
    allTeachers: (Group['main_teacher'])[]
    allRooms: (Group['room'])[]
  }
  
export default function ScheduleView({
    groups,
    onReschedule,
    onGroupClick,
    onDuplicateGroup,
    getGroupColor,
    detectConflicts,
    detectCapacityWarning,
    showConflicts,
    startHour,
    endHour,
    currentWeekOffset,
    weekRange,
    swimlaneBy,
    allTeachers,
    allRooms,
  }: ScheduleViewProps) {
    const [draggedGroup, setDraggedGroup] = useState<Group | null>(null)
    const [contextMenu, setContextMenu] = useState<{
      visible: boolean
      x: number
      y: number
      group: Group | null
    }>({
      visible: false,
      x: 0,
      y: 0,
      group: null
    })
  
    const daysOfWeek = WEEK_DAYS
    const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => i + startHour)
  
    // Determine lanes based on swimlaneBy prop
    const lanes = swimlaneBy === 'teacher' ? allTeachers : swimlaneBy === 'room' ? allRooms : []
    const laneTitle = swimlaneBy === 'teacher' ? 'Teacher' : swimlaneBy === 'room' ? 'Room' : ''
  
    // Get specific date for each day in the week
    const getDayDate = (dayName: WeekDay): Date => {
      const dayIndex = daysOfWeek.indexOf(dayName)
      const date = new Date(weekRange.start)
      date.setDate(weekRange.start.getDate() + dayIndex)
      return date
    }
  
    // Format day with date
    const formatDayWithDate = (dayName: WeekDay): string => {
      const date = getDayDate(dayName)
      const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
      return `${dayName}, ${date.toLocaleDateString('en-US', options)}`
    }
  
    // Get groups for a specific day and hour
    const getGroupsForSlot = (day: WeekDay, hour: number, groupSet: Group[]): Group[] => {
      return groupSet.filter(group => {
        if (!group.days || !group.start_time || !group.end_time) {
          return false
        }
  
        const groupDays = parseGroupDays(group.days)
        if (!groupDays.includes(day)) return false
  
        const startTimeParts = group.start_time.split(':')
        const endTimeParts = group.end_time.split(':')
  
        const startHour = parseInt(startTimeParts[0])
        const endHour = parseInt(endTimeParts[0])
        const endMinutes = parseInt(endTimeParts[1] || '0')
  
        return startHour === hour || (startHour < hour && (hour < endHour || (hour === endHour && endMinutes > 0)))
      })
    }
  
    // Check if this is the starting slot for the group
    const isStartingSlot = (group: Group, day: WeekDay, hour: number): boolean => {
      if (!group.days || !group.start_time) return false
  
      const groupDays = parseGroupDays(group.days)
      if (!groupDays.includes(day)) return false
  
      const startHour = parseInt(group.start_time.split(':')[0])
      return startHour === hour
    }
  
    // Calculate how many hours the group spans
    const getGroupSpan = (group: Group): number => {
      if (!group.start_time || !group.end_time) return 1
  
      const startParts = group.start_time.split(':')
      const endParts = group.end_time.split(':')
  
      const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1] || '0')
      const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1] || '0')
      const durationMinutes = endMinutes - startMinutes
  
      return Math.max(1, Math.ceil(durationMinutes / 60))
    }
  
    const handleDragStart = (e: React.DragEvent, group: Group) => {
      setDraggedGroup(group)
      e.dataTransfer.effectAllowed = 'move'
    }
  
    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
    }
  
    const handleDrop = (e: React.DragEvent, day: WeekDay, hour: number) => {
        e.preventDefault()
        const newTime = `${hour.toString().padStart(2, '0')}:00`
    
        // Case 1: Drag originated from within the schedule
        if (draggedGroup) {
          onReschedule(draggedGroup.id, day, newTime)
          setDraggedGroup(null)
          return
        }
    
        // Case 2: Drag originated from the unscheduled panel
        const groupData = e.dataTransfer.getData('text/plain')
        if (groupData) {
          try {
            const group = JSON.parse(groupData) as Group;
            onReschedule(group.id, day, newTime);
          } catch (err) {
            console.error("Failed to parse dropped group data", err)
          }
        }
      }
  
    const handleDragEnd = () => {
      setDraggedGroup(null)
    }
  
    // Context menu handlers
    const handleContextMenu = (e: React.MouseEvent, group: Group) => {
      e.preventDefault()
      e.stopPropagation()
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        group
      })
    }
  
    const closeContextMenu = () => {
      setContextMenu({ visible: false, x: 0, y: 0, group: null })
    }
  
    const handleDuplicateToDay = (day: WeekDay) => {
      if (contextMenu.group) {
        onDuplicateGroup(contextMenu.group, [day])
        closeContextMenu()
      }
    }
  
    const handleQuickDuplicate = (days: string[]) => {
      if (contextMenu.group) {
        onDuplicateGroup(contextMenu.group, days)
        closeContextMenu()
      }
    }
  
    // Close context menu when clicking outside
    useEffect(() => {
      const handleClick = () => closeContextMenu()
      if (contextMenu.visible) {
        document.addEventListener('click', handleClick)
        return () => document.removeEventListener('click', handleClick)
      }
    }, [contextMenu.visible])
  
    return (
        <div className="card overflow-hidden">
          {/* Title */}
          <div className="p-4 border-b border-border">
            <h2 className="text-xl font-semibold">Weekly Schedule</h2>
            <p className="text-sm text-text-secondary mt-1">
              Drag and drop groups to reschedule • Changes save automatically
            </p>
          </div>
    
          {/* Schedule Grid */}
          <div className="overflow-x-auto">
            <div className="min-w-[1200px]">
              {/* Header */}
              <div className="flex border-b border-border bg-surface/50 sticky top-0 z-20">
                <div className="w-32 flex-shrink-0 p-3 font-semibold border-r border-border">
                  {swimlaneBy === 'none' ? 'Day / Time' : laneTitle}
                </div>
                {swimlaneBy === 'none'
                  ? hours.map(hour => (
                    <div key={hour} className="flex-1 min-w-[80px] p-3 text-center text-sm font-medium border-r border-border">
                      {hour}:00
                    </div>
                  ))
                  : daysOfWeek.map(day => (
                    <div key={day} className="flex-1 min-w-[120px] p-3 text-center text-sm font-medium border-r border-border">
                      {formatDayWithDate(day)}
                    </div>
                  ))
                }
              </div>
    
              {/* Grid Body */}
              {swimlaneBy === 'none' ? (
                // =================================
                //  Original View (Rows are Days)
                // =================================
                daysOfWeek.map(day => {
                  const isToday = getDayDate(day).toDateString() === new Date().toDateString()
                  return (
                    <div key={day} className="flex border-b border-border hover:bg-surface/30 transition-colors">
                      {/* Day Label */}
                      <div className={`w-32 flex-shrink-0 p-3 font-medium border-r border-border bg-surface/50 ${isToday ? 'bg-primary/10 text-primary' : ''}`}>
                        <div className="text-sm">{day}</div>
                        <div className="text-xs text-text-secondary">
                          {getDayDate(day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
    
                      {/* Time Slots */}
                      {hours.map(hour => {
                        const slotGroups = getGroupsForSlot(day, hour, groups)
                        const startingGroups = slotGroups.filter(g => isStartingSlot(g, day, hour))
    
                        return (
                          <div
                            key={`${day}-${hour}`}
                            className="flex-1 min-w-[80px] min-h-[60px] p-1 border-r border-border relative"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, day, hour)}
                          >
                            {startingGroups.map(group => {
                              const span = getGroupSpan(group);
                              const conflicts = showConflicts ? detectConflicts(group, day, hour) : [];
                              const capacityWarning = detectCapacityWarning(group);
    
                              return (
                                <div
                                  key={group.id}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, group)}
                                  onDragEnd={handleDragEnd}
                                  onClick={() => onGroupClick(group)}
                                  onContextMenu={(e) => handleContextMenu(e, group)}
                                  className="absolute inset-1 rounded-lg cursor-move hover:shadow-lg transition-all z-10"
                                  style={{
                                    width: `calc(${span * 100}% + ${(span - 1) * 0.25}rem)`,
                                  }}
                                >
                                  <GroupCard
                                    group={group}
                                    getGroupColor={getGroupColor}
                                    hasConflict={conflicts.length > 0}
                                    capacityWarning={capacityWarning}
                                  />
                                </div>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  )
                })
              ) : (
                // =================================
                //  Swimlane View (Rows are Lanes)
                // =================================
                lanes.map((lane: any) => {
                    const laneGroups = groups.filter(g => {
                        if (swimlaneBy === 'teacher') return g.main_teacher?.id === lane.id
                        if (swimlaneBy === 'room') return g.room?.id === lane.id
                        return false
                    })
        
                    // Calculate total weekly hours for the lane
                    const weeklyHours = laneGroups.reduce((total, group) => {
                        const duration = getGroupSpan(group); // Duration in hours for one session
                        const daysInWeek = parseGroupDays(group.days).length; // Number of sessions per week
                        return total + (duration * daysInWeek);
                    }, 0);
        
                    // Assume a 40-hour week capacity as backend doesn't provide this
                    const weeklyCapacity = 40;
                    const loadPercentage = (weeklyHours / weeklyCapacity) * 100;
        
                    let loadColor = 'text-green-500';
                    if (loadPercentage > 75) loadColor = 'text-orange-500';
                    if (loadPercentage > 100) loadColor = 'text-red-500';
        
                    return (
                        <div key={lane.id} className="flex border-b border-border hover:bg-surface/30 transition-colors">
                        {/* Lane Header */}
                        <div className="w-32 flex-shrink-0 p-3 font-medium border-r border-border bg-surface/50">
                            <div className="text-sm truncate font-semibold">{lane.username || lane.name}</div>
                            <div className={`text-xs font-bold mt-1 ${loadColor}`}>
                            {weeklyHours} / {weeklyCapacity} hrs
                            </div>
                        </div>
        
                        {/* Day Slots */}
                        {daysOfWeek.map(day => {
                            const dayGroups = laneGroups.filter(g => parseGroupDays(g.days).includes(day))

                            return (
                                <div
                                key={`${lane.id}-${day}`}
                                className="flex-1 min-w-[120px] min-h-[60px] p-1 border-r border-border relative"
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, day, startHour)}
                                >
                                {dayGroups.map(group => {
                                    const totalHoursInView = endHour - startHour;
                                    if (totalHoursInView <= 0) return null;
        
                                    const groupStart = new Date(`1970-01-01T${group.start_time}`);
                                    const groupStartTotalHours = groupStart.getHours() + groupStart.getMinutes() / 60;
                                    
                                    const groupEnd = new Date(`1970-01-01T${group.end_time}`);
                                    const groupEndTotalHours = groupEnd.getHours() + groupEnd.getMinutes() / 60;
        
                                    // Skip if group is completely outside the visible hours
                                    if (groupEndTotalHours < startHour || groupStartTotalHours > endHour) {
                                    return null;
                                    }
        
                                    // Clamp start and end times to the visible range
                                    const clampedStartHour = Math.max(groupStartTotalHours, startHour);
                                    const clampedEndHour = Math.min(groupEndTotalHours, endHour);
        
                                    const leftPercent = ((clampedStartHour - startHour) / totalHoursInView) * 100;
                                    const widthPercent = ((clampedEndHour - clampedStartHour) / totalHoursInView) * 100;
                                    
                                    const conflicts = showConflicts ? detectConflicts(group, day, groupStart.getHours()) : [];
                                    const capacityWarning = detectCapacityWarning(group);
        
                                    return (
                                    <div
                                        key={group.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, group)}
                                        onDragEnd={handleDragEnd}
                                        onClick={() => onGroupClick(group)}
                                        onContextMenu={(e) => handleContextMenu(e, group)}
                                        className="absolute rounded-lg cursor-move hover:shadow-lg transition-all z-10"
                                        style={{
                                        top: '0.25rem',
                                        bottom: '0.25rem',
                                        left: `${leftPercent}%`,
                                        width: `${widthPercent}%`,
                                        }}
                                    >
                                        <GroupCard
                                        group={group}
                                        getGroupColor={getGroupColor}
                                        hasConflict={conflicts.length > 0}
                                        capacityWarning={capacityWarning}
                                        />
                                    </div>
                                    )
                                })}
                                </div>
                            )
                        })}
                        </div>
                    )
                })
              )}
            </div>
          </div>
    
          {/* Legend */}
          <div className="p-4 bg-surface/30 border-t border-border">
            <div className="flex items-center justify-between text-sm text-text-secondary flex-wrap gap-3">
              <div className="flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30 rounded"></div>
                  <span>Class schedule</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[8px]">⚠</div>
                  <span>Scheduling conflict</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center text-[8px]">📊</div>
                  <span>Room nearly full (90%+)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[8px]">📊</div>
                  <span>Room over capacity</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>💡</span>
                  <span>Drag to reschedule • Click for details • Right-click to duplicate</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>⌨️</span>
                  <span>Ctrl+Z: Undo • Ctrl+Y: Redo</span>
                </div>
              </div>
              <div className="text-xs">
                {groups.length} total groups
              </div>
            </div>
          </div>
    
          {/* Empty State */}
          {groups.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50">
              <div className="text-center">
                <Calendar className="h-16 w-16 text-text-secondary mx-auto mb-4 opacity-50" />
                <p className="text-lg font-semibold mb-2">No Groups Scheduled</p>
                <p className="text-sm text-text-secondary">
                  Create a group with schedule to see it here
                </p>
              </div>
            </div>
          )}
    
          {/* Context Menu */}
          {contextMenu.visible && contextMenu.group && (
            <div
              className="fixed bg-surface border border-border rounded-lg shadow-2xl py-2 z-[9999]"
              style={{
                left: `${contextMenu.x}px`,
                top: `${contextMenu.y}px`,
                minWidth: '220px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-3 py-2 border-b border-border">
                <p className="text-xs font-semibold text-text-secondary">Duplicate Group</p>
                <p className="text-sm font-medium truncate">{contextMenu.group.name}</p>
              </div>
    
              {/* Quick Duplicate Options */}
              <div className="py-1">
                <button
                  onClick={() => handleQuickDuplicate(['Monday', 'Wednesday', 'Friday'])}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-primary/10 transition-colors flex items-center gap-2"
                >
                  <span>📅</span>
                  <span>Duplicate to Mon/Wed/Fri</span>
                </button>
                <button
                  onClick={() => handleQuickDuplicate(['Tuesday', 'Thursday'])}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-primary/10 transition-colors flex items-center gap-2"
                >
                  <span>📅</span>
                  <span>Duplicate to Tue/Thu</span>
                </button>
                <button
                  onClick={() => handleQuickDuplicate(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-primary/10 transition-colors flex items-center gap-2"
                >
                  <span>📅</span>
                  <span>Duplicate to All Weekdays</span>
                </button>
              </div>
    
              {/* Duplicate to Specific Day */}
              <div className="border-t border-border py-1">
                <p className="px-3 py-1 text-xs font-semibold text-text-secondary">Duplicate to specific day:</p>
                {daysOfWeek.map(day => (
                  <button
                    key={day}
                    onClick={() => handleDuplicateToDay(day)}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-primary/10 transition-colors"
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )
  }
  
