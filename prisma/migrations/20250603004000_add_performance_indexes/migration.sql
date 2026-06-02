-- CreateIndex
CREATE INDEX `AccidentCase_status_idx` ON `AccidentCase`(`status`);

-- CreateIndex
CREATE UNIQUE INDEX `AccidentCase_caseNumber_key` ON `AccidentCase`(`caseNumber`);

-- CreateIndex
CREATE INDEX `ActivityLog_createdAt_idx` ON `ActivityLog`(`createdAt`);

-- CreateIndex
CREATE INDEX `Car_carNumber_idx` ON `Car`(`carNumber`);

-- CreateIndex
CREATE INDEX `Insurance_endDate_idx` ON `Insurance`(`endDate`);

-- CreateIndex
CREATE INDEX `Insurance_status_idx` ON `Insurance`(`status`);
