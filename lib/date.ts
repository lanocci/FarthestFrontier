export function formatDateInput(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getDashboardPracticeDate(today = new Date()): string {
  const base = new Date(today);
  const day = base.getDay();

  if (day === 0) {
    base.setDate(base.getDate() - 1);
    return formatDateInput(base);
  }

  if (day === 6) {
    return formatDateInput(base);
  }

  base.setDate(base.getDate() + (6 - day));
  return formatDateInput(base);
}

export function formatDisplayDate(dateText: string): string {
  return dateText.replace(/-/g, "/");
}

export function getRecentPracticeDates(count = 6, anchorDate = getDashboardPracticeDate()): string[] {
  const [year, month, day] = anchorDate.split("-").map(Number);
  const base = new Date(year, month - 1, day);

  return Array.from({ length: count }, (_, index) => {
    const next = new Date(base);
    next.setDate(base.getDate() - index * 7);
    return formatDateInput(next);
  });
}
