/**
 * Generates a default notebook name based on the current date and time.
 *
 * @returns A string representing the default notebook name, with
 *          the format: "Notebook_YYYY-MM-DD_HH-MM-SS"
 */
export function generateDefaultNotebookName(): string {
  const now = new Date();

  const pad = (n: number) => n.toString().padStart(2, '0');

  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

  return `Notebook_${date}_${time}`;
}
