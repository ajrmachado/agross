CREATE TABLE `email_daily_sends` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sendDate` date NOT NULL,
	`sentAt` timestamp NOT NULL,
	`subscriberCount` int NOT NULL DEFAULT 0,
	`status` enum('sent','failed') NOT NULL DEFAULT 'sent',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_daily_sends_id` PRIMARY KEY(`id`),
	CONSTRAINT `email_daily_sends_sendDate_unique` UNIQUE(`sendDate`)
);
--> statement-breakpoint
CREATE INDEX `idx_email_daily_sends_sendDate` ON `email_daily_sends` (`sendDate`);