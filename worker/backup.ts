import { DatabaseSync, backup } from "node:sqlite";
import { chmodSync, existsSync } from "node:fs";
const source = process.argv[2],
  destination = process.argv[3];
if (
  !source ||
  !destination ||
  source === destination ||
  existsSync(destination)
)
  throw new Error("Specify database and a new backup file");
const db = new DatabaseSync(source, { readOnly: true });
try {
  await backup(db, destination);
  chmodSync(destination, 0o600);
  console.log("Consistent SQLite backup completed");
} finally {
  db.close();
}
