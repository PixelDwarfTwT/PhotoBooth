-- Remove the rejected Spider-Man frame and its unshared frame asset from the
-- published catalog while keeping the storage object available for recovery.
UPDATE "frames"
SET "status" = 'ARCHIVED'
WHERE "id" = 'f1e2949f-a618-454d-86e7-9dccb5c990b4'
  AND "name" = 'Spider-Man film';

UPDATE "assets"
SET "status" = 'ARCHIVED'
WHERE "id" = '77517100-38e8-4f02-a537-30693a3231aa'
  AND "asset_type" = 'FRAME'
  AND NOT EXISTS (
    SELECT 1
    FROM "frames"
    WHERE "asset_id" = '77517100-38e8-4f02-a537-30693a3231aa'
      AND "status" = 'PUBLISHED'
  );
