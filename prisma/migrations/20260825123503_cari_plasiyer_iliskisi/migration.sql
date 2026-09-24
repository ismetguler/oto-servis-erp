-- CreateIndex
CREATE INDEX "cariler_bolgeId_idx" ON "cariler"("bolgeId");

-- CreateIndex
CREATE INDEX "cariler_plasiyerId_idx" ON "cariler"("plasiyerId");

-- AddForeignKey
ALTER TABLE "cariler" ADD CONSTRAINT "cariler_plasiyerId_fkey" FOREIGN KEY ("plasiyerId") REFERENCES "cariler"("id") ON DELETE SET NULL ON UPDATE CASCADE;
