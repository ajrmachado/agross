CREATE TABLE `periodic_summaries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('weekly','monthly') NOT NULL,
	`periodLabel` varchar(64) NOT NULL,
	`periodStart` date NOT NULL,
	`periodEnd` date NOT NULL,
	`content` text NOT NULL,
	`highlights` text,
	`articleCount` int NOT NULL DEFAULT 0,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `periodic_summaries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_periodic_type_label` ON `periodic_summaries` (`type`,`periodLabel`);