-- Create article_highlights table
CREATE TABLE IF NOT EXISTS "article_highlights" (
    "id" SERIAL PRIMARY KEY,
    "text" TEXT NOT NULL,
    "annotation" TEXT,
    "color" VARCHAR(50) DEFAULT 'yellow',
    "rangeIndex" INTEGER,
    "userId" INTEGER NOT NULL,
    "articleId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FK_article_highlights_user" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE,
    CONSTRAINT "FK_article_highlights_article" FOREIGN KEY ("articleId") REFERENCES "articles" ("id") ON DELETE CASCADE
);

-- Index for faster lookups by user and article
CREATE INDEX IF NOT EXISTS "IDX_article_highlights_user_article" ON "article_highlights" ("userId", "articleId");
