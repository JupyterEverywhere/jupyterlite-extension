export type UUID = string;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateUUID(data: string): data is UUID {
  return uuidPattern.test(data);
}
