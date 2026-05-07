ALTER TABLE "items"
  ALTER COLUMN "date" TYPE date USING ("date" + INTERVAL '9 hours')::date,
  ALTER COLUMN "date" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date;
