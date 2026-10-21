-- CreateIndex
CREATE INDEX "Comment_ipHash_createdAt_idx" ON "Comment"("ipHash", "createdAt");

-- CreateIndex
CREATE INDEX "Post_published_views_idx" ON "Post"("published", "views");
