export const WEEK_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const

export type WeekDay = (typeof WEEK_DAYS)[number]

const DAY_ALIASES: Record<string, WeekDay> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
  mon: 'Monday',
  tue: 'Tuesday',
  tues: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  thur: 'Thursday',
  thurs: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
  dushanba: 'Monday',
  seshanba: 'Tuesday',
  chorshanba: 'Wednesday',
  payshanba: 'Thursday',
  juma: 'Friday',
  shanba: 'Saturday',
  yakshanba: 'Sunday',
  dush: 'Monday',
  sesh: 'Tuesday',
  chor: 'Wednesday',
  pay: 'Thursday',
  jum: 'Friday',
  shan: 'Saturday',
  yak: 'Sunday',
}

const SHORT_DAY_MAP: Record<WeekDay, string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
}

export const normalizeDayToken = (value: string): WeekDay | null => {
  const normalized = value.trim().toLowerCase().replace(/[^a-z]/g, '')
  if (!normalized) return null
  return DAY_ALIASES[normalized] || null
}

export const parseGroupDays = (days: string): WeekDay[] => {
  if (!days) return []

  return days
    .split(',')
    .map((token) => normalizeDayToken(token))
    .filter((day): day is WeekDay => Boolean(day))
}

export const toShortDayLabel = (day: string): string => {
  const normalized = normalizeDayToken(day)
  if (!normalized) return day
  return SHORT_DAY_MAP[normalized]
}

