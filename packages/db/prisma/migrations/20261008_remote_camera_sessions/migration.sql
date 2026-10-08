CREATE TABLE "remote_camera_sessions" (
  "session_id" VARCHAR(43) NOT NULL,
  "offer_sdp" TEXT,
  "answer_sdp" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "remote_camera_sessions_pkey" PRIMARY KEY ("session_id"),
  CONSTRAINT "remote_camera_sessions_session_id_format_check"
    CHECK ("session_id" ~ '^[A-Za-z0-9_-]{43}$'),
  CONSTRAINT "remote_camera_sessions_expiry_check"
    CHECK ("expires_at" > "created_at")
);

CREATE INDEX "remote_camera_sessions_expires_at_idx"
  ON "remote_camera_sessions"("expires_at");
