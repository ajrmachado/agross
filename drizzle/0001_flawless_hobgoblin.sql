CREATE TABLE `articles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`feedId` int NOT NULL,
	`guid` varchar(1024) NOT NULL,
	`title` varchar(1024) NOT NULL,
	`description` text,
	`link` varchar(1024),
	`source` varchar(255) NOT NULL,
	`category` enum('mercado','commodities','clima','politica_agricola','tecnologia','internacional','geral') NOT NULL DEFAULT 'geral',
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `articles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `daily_summaries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`summaryDate` date NOT NULL,
	`content` text NOT NULL,
	`articleCount` int NOT NULL DEFAULT 0,
	`highlights` text,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `daily_summaries_id` PRIMARY KEY(`id`),
	CONSTRAINT `daily_summaries_summaryDate_unique` UNIQUE(`summaryDate`)
);
--> statement-breakpoint
CREATE TABLE `job_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobName` varchar(128) NOT NULL,
	`status` enum('running','success','error') NOT NULL,
	`message` text,
	`articlesAdded` int DEFAULT 0,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`finishedAt` timestamp,
	CONSTRAINT `job_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rss_feeds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`url` varchar(1024) NOT NULL,
	`category` enum('mercado','commodities','clima','politica_agricola','tecnologia','internacional','geral') NOT NULL DEFAULT 'geral',
	`active` boolean NOT NULL DEFAULT true,
	`lastFetchedAt` timestamp,
	`fetchErrorCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rss_feeds_id` PRIMARY KEY(`id`),
	CONSTRAINT `rss_feeds_url_unique` UNIQUE(`url`)
);
--> statement-breakpoint
ALTER TABLE `articles` ADD CONSTRAINT `articles_feedId_rss_feeds_id_fk` FOREIGN KEY (`feedId`) REFERENCES `rss_feeds`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_articles_feedId` ON `articles` (`feedId`);--> statement-breakpoint
CREATE INDEX `idx_articles_publishedAt` ON `articles` (`publishedAt`);--> statement-breakpoint
CREATE INDEX `idx_articles_category` ON `articles` (`category`);--> statement-breakpoint
CREATE INDEX `idx_articles_guid` ON `articles` (`guid`);