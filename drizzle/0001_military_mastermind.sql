CREATE TABLE `activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` enum('correspondence','decision','circular') NOT NULL,
	`entityId` int NOT NULL,
	`action` varchar(100) NOT NULL,
	`note` text,
	`previousStatus` varchar(40),
	`nextStatus` varchar(40),
	`actorId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentType` enum('correspondence','decision','circular') NOT NULL,
	`documentId` int NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`fileUrl` varchar(700) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`sizeBytes` int NOT NULL,
	`uploadedById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `circular_recipients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`circularId` int NOT NULL,
	`departmentId` int NOT NULL,
	`acknowledgementStatus` enum('unread','acknowledged') NOT NULL DEFAULT 'unread',
	`acknowledgedAt` timestamp,
	CONSTRAINT `circular_recipients_id` PRIMARY KEY(`id`),
	CONSTRAINT `circular_recipient_unique` UNIQUE(`circularId`,`departmentId`)
);
--> statement-breakpoint
CREATE TABLE `circulars` (
	`id` int AUTO_INCREMENT NOT NULL,
	`circularNumber` varchar(64) NOT NULL,
	`sequenceNumber` int NOT NULL,
	`year` int NOT NULL,
	`subject` text NOT NULL,
	`issueDate` timestamp NOT NULL,
	`issuingDepartmentId` int,
	`sourceCorrespondenceId` int,
	`createdById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `circulars_id` PRIMARY KEY(`id`),
	CONSTRAINT `circulars_number_unique` UNIQUE(`circularNumber`)
);
--> statement-breakpoint
CREATE TABLE `correspondence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('incoming','outgoing') NOT NULL,
	`referenceNumber` varchar(64) NOT NULL,
	`sequenceNumber` int NOT NULL,
	`year` int NOT NULL,
	`subject` text NOT NULL,
	`sourceEntity` varchar(240) NOT NULL,
	`destinationEntity` varchar(240),
	`documentDate` timestamp NOT NULL,
	`receivedAt` timestamp,
	`sentAt` timestamp,
	`priority` enum('normal','urgent','confidential') NOT NULL DEFAULT 'normal',
	`status` enum('new','referred','in_progress','completed','archived') NOT NULL DEFAULT 'new',
	`currentDepartmentId` int,
	`createdById` int NOT NULL,
	`relatedIncomingId` int,
	`dueAt` timestamp,
	`completedAt` timestamp,
	`archivedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `correspondence_id` PRIMARY KEY(`id`),
	CONSTRAINT `correspondence_reference_unique` UNIQUE(`referenceNumber`)
);
--> statement-breakpoint
CREATE TABLE `decisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`decisionNumber` varchar(64) NOT NULL,
	`sequenceNumber` int NOT NULL,
	`year` int NOT NULL,
	`subject` text NOT NULL,
	`issuingDepartmentId` int,
	`sourceCorrespondenceId` int,
	`effectiveDate` timestamp NOT NULL,
	`legalStatus` enum('active','amended','cancelled') NOT NULL DEFAULT 'active',
	`referenceDecisionId` int,
	`createdById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `decisions_id` PRIMARY KEY(`id`),
	CONSTRAINT `decisions_number_unique` UNIQUE(`decisionNumber`)
);
--> statement-breakpoint
CREATE TABLE `departments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nameAr` varchar(180) NOT NULL,
	`code` varchar(32) NOT NULL,
	`parentId` int,
	`type` enum('office','department','unit') NOT NULL DEFAULT 'department',
	`isActive` enum('yes','no') NOT NULL DEFAULT 'yes',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `departments_id` PRIMARY KEY(`id`),
	CONSTRAINT `departments_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `referrals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`correspondenceId` int NOT NULL,
	`fromDepartmentId` int,
	`toDepartmentId` int NOT NULL,
	`referredById` int NOT NULL,
	`instruction` text NOT NULL,
	`statusAfterReferral` enum('referred','in_progress') NOT NULL DEFAULT 'referred',
	`dueAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referrals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','director_general','follow_up','department_head','staff') NOT NULL DEFAULT 'staff';--> statement-breakpoint
ALTER TABLE `users` ADD `departmentId` int;--> statement-breakpoint
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_actorId_users_id_fk` FOREIGN KEY (`actorId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attachments` ADD CONSTRAINT `attachments_uploadedById_users_id_fk` FOREIGN KEY (`uploadedById`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `circular_recipients` ADD CONSTRAINT `circular_recipients_circularId_circulars_id_fk` FOREIGN KEY (`circularId`) REFERENCES `circulars`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `circular_recipients` ADD CONSTRAINT `circular_recipients_departmentId_departments_id_fk` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `circulars` ADD CONSTRAINT `circulars_issuingDepartmentId_departments_id_fk` FOREIGN KEY (`issuingDepartmentId`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `circulars` ADD CONSTRAINT `circulars_sourceCorrespondenceId_correspondence_id_fk` FOREIGN KEY (`sourceCorrespondenceId`) REFERENCES `correspondence`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `circulars` ADD CONSTRAINT `circulars_createdById_users_id_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `correspondence` ADD CONSTRAINT `correspondence_currentDepartmentId_departments_id_fk` FOREIGN KEY (`currentDepartmentId`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `correspondence` ADD CONSTRAINT `correspondence_createdById_users_id_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `decisions` ADD CONSTRAINT `decisions_issuingDepartmentId_departments_id_fk` FOREIGN KEY (`issuingDepartmentId`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `decisions` ADD CONSTRAINT `decisions_sourceCorrespondenceId_correspondence_id_fk` FOREIGN KEY (`sourceCorrespondenceId`) REFERENCES `correspondence`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `decisions` ADD CONSTRAINT `decisions_createdById_users_id_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `referrals` ADD CONSTRAINT `referrals_correspondenceId_correspondence_id_fk` FOREIGN KEY (`correspondenceId`) REFERENCES `correspondence`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `referrals` ADD CONSTRAINT `referrals_fromDepartmentId_departments_id_fk` FOREIGN KEY (`fromDepartmentId`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `referrals` ADD CONSTRAINT `referrals_toDepartmentId_departments_id_fk` FOREIGN KEY (`toDepartmentId`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `referrals` ADD CONSTRAINT `referrals_referredById_users_id_fk` FOREIGN KEY (`referredById`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `activity_logs_entity_created_idx` ON `activity_logs` (`entityType`,`entityId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `attachments_document_idx` ON `attachments` (`documentType`,`documentId`);--> statement-breakpoint
CREATE INDEX `correspondence_status_due_idx` ON `correspondence` (`status`,`dueAt`);--> statement-breakpoint
CREATE INDEX `correspondence_current_department_idx` ON `correspondence` (`currentDepartmentId`);--> statement-breakpoint
CREATE INDEX `referrals_correspondence_created_idx` ON `referrals` (`correspondenceId`,`createdAt`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_departmentId_departments_id_fk` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;