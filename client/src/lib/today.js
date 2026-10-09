const pad = n => String(n).padStart(2, '0');
export const todayString = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
