CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recipientUserId` int NOT NULL,
	`type` enum('report_submitted','workflow_update','system') NOT NULL,
	`title` varchar(180) NOT NULL,
	`content` text NOT NULL,
	`relatedEntityType` varchar(40),
	`relatedEntityId` int,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_recipientUserId_users_id_fk` FOREIGN KEY (`recipientUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `notifications_recipient_read_created_idx` ON `notifications` (`recipientUserId`,`readAt`,`createdAt`);