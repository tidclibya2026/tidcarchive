export type AccountActivityExportRow = {
  createdAt: Date;
  action: string;
  detail: string | null;
  userName: string | null;
  userEmail: string | null;
  actorName: string | null;
};

function csvCell(value: string | null | undefined) {
  const text = value ?? "";
  return `"${text.replace(/"/g, '""')}"`;
}

export function exportAccountActivityCsv(rows: AccountActivityExportRow[]) {
  const headings = ["التاريخ والتوقيت", "الإجراء", "تفاصيل الإجراء", "الحساب المتأثر", "البريد الإلكتروني", "منفذ الإجراء"];
  const body = rows.map(row => [row.createdAt.toISOString(), row.action, row.detail, row.userName, row.userEmail, row.actorName].map(value => csvCell(value)).join(","));
  return `\uFEFF${[headings.map(csvCell).join(","), ...body].join("\r\n")}`;
}
