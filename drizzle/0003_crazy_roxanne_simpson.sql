CREATE TABLE `account_activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`actorId` int,
	`action` varchar(100) NOT NULL,
	`detail` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `account_activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `accountType` enum('oauth','local') DEFAULT 'oauth' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(512);--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` enum('yes','no') DEFAULT 'yes' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `officeId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `passwordChangedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);--> statement-breakpoint
ALTER TABLE `account_activity_logs` ADD CONSTRAINT `account_activity_logs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `account_activity_logs` ADD CONSTRAINT `account_activity_logs_actorId_users_id_fk` FOREIGN KEY (`actorId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `account_activity_user_created_idx` ON `account_activity_logs` (`userId`,`createdAt`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_officeId_departments_id_fk` FOREIGN KEY (`officeId`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `users_department_office_idx` ON `users` (`departmentId`,`officeId`);--> statement-breakpoint
CREATE INDEX `users_account_state_idx` ON `users` (`accountType`,`isActive`);