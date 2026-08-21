ALTER TABLE `correspondence` ADD `classification` varchar(120) DEFAULT 'عام' NOT NULL;--> statement-breakpoint
ALTER TABLE `correspondence` ADD `confidentiality` enum('public','internal','confidential','secret') DEFAULT 'internal' NOT NULL;--> statement-breakpoint
ALTER TABLE `correspondence` ADD `keywords` text;--> statement-breakpoint
ALTER TABLE `correspondence` ADD `archiveStatus` enum('registered','approved','archived') DEFAULT 'registered' NOT NULL;--> statement-breakpoint
CREATE INDEX `correspondence_archive_metadata_idx` ON `correspondence` (`classification`,`archiveStatus`);