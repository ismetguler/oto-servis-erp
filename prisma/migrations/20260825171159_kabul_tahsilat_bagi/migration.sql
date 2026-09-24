-- CreateIndex
CREATE INDEX "tahsilatlar_kabulId_idx" ON "tahsilatlar"("kabulId");

-- AddForeignKey
ALTER TABLE "tahsilatlar" ADD CONSTRAINT "tahsilatlar_kabulId_fkey" FOREIGN KEY ("kabulId") REFERENCES "kabuller"("id") ON DELETE SET NULL ON UPDATE CASCADE;
