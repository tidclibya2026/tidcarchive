CREATE TABLE `external_entities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nameAr` varchar(240) NOT NULL,
	`category` enum('ministry','authority','agency','service','municipality','other') NOT NULL DEFAULT 'other',
	`isActive` enum('yes','no') NOT NULL DEFAULT 'yes',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `external_entities_id` PRIMARY KEY(`id`),
	CONSTRAINT `external_entities_name_unique` UNIQUE(`nameAr`)
);
--> statement-breakpoint
ALTER TABLE `departments` MODIFY COLUMN `type` enum('office','department','section','unit') NOT NULL DEFAULT 'department';--> statement-breakpoint
ALTER TABLE `correspondence` ADD `sourceDepartmentId` int;--> statement-breakpoint
ALTER TABLE `correspondence` ADD `destinationDepartmentId` int;--> statement-breakpoint
ALTER TABLE `correspondence` ADD `sourceExternalEntityId` int;--> statement-breakpoint
ALTER TABLE `correspondence` ADD `destinationExternalEntityId` int;--> statement-breakpoint
CREATE INDEX `external_entities_active_idx` ON `external_entities` (`isActive`);--> statement-breakpoint
ALTER TABLE `correspondence` ADD CONSTRAINT `corr_src_dept_fk` FOREIGN KEY (`sourceDepartmentId`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `correspondence` ADD CONSTRAINT `corr_dst_dept_fk` FOREIGN KEY (`destinationDepartmentId`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `correspondence` ADD CONSTRAINT `corr_src_ext_fk` FOREIGN KEY (`sourceExternalEntityId`) REFERENCES `external_entities`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `correspondence` ADD CONSTRAINT `corr_dst_ext_fk` FOREIGN KEY (`destinationExternalEntityId`) REFERENCES `external_entities`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `correspondence_party_lookup_idx` ON `correspondence` (`sourceExternalEntityId`,`destinationExternalEntityId`);--> statement-breakpoint
CREATE INDEX `departments_parent_idx` ON `departments` (`parentId`);
