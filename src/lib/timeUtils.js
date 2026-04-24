export const DEFAULT_TIME_ZONE = 'Asia/Kolkata';

export const getZonedParts = (date = new Date(), timeZone = DEFAULT_TIME_ZONE) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
};

export const formatZonedDate = (date = new Date(), timeZone = DEFAULT_TIME_ZONE) => {
  const { year, month, day } = getZonedParts(date, timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export const getZonedMinutes = (date = new Date(), timeZone = DEFAULT_TIME_ZONE) => {
  const { hour, minute } = getZonedParts(date, timeZone);
  return hour * 60 + minute;
};

export const isBeforeZonedCutoff = (
  date = new Date(),
  cutoffHour,
  cutoffMinute,
  timeZone = DEFAULT_TIME_ZONE
) => {
  return getZonedMinutes(date, timeZone) < (cutoffHour * 60 + cutoffMinute);
};
