ALTER TABLE `attachments` ADD `ocrStatus` enum('pending','processing','completed','failed','not_supported') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `attachments` ADD `ocrAttemptedAt` timestamp;--> statement-breakpoint
ALTER TABLE `attachments` ADD `ocrCompletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `attachments` ADD `ocrError` varchar(500);--> statement-breakpoint
CREATE INDEX `attachments_ocr_status_idx` ON `attachments` (`ocrStatus`);