CREATE TABLE `official_pdf_download_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentType` enum('decision','circular') NOT NULL,
	`documentId` int NOT NULL,
	`userId` int NOT NULL,
	`userRole` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `official_pdf_download_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `official_pdf_download_logs` ADD CONSTRAINT `official_pdf_download_logs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `official_pdf_download_document_created_idx` ON `official_pdf_download_logs` (`documentType`,`documentId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `official_pdf_download_user_created_idx` ON `official_pdf_download_logs` (`userId`,`createdAt`);