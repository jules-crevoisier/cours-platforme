-- Classement des cours par semestre (filtre de la liste).
ALTER TABLE `Course` ADD COLUMN `semester` VARCHAR(8) NULL;
CREATE INDEX `Course_semester_idx` ON `Course`(`semester`);
