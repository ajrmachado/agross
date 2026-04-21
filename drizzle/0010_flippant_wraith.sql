CREATE TABLE `whatsapp_auto_sends` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sendDate` date NOT NULL,
	`generatedText` text NOT NULL,
	`sentAt` timestamp,
	`totalSent` int NOT NULL DEFAULT 0,
	`totalFailed` int NOT NULL DEFAULT 0,
	`totalSkipped` int NOT NULL DEFAULT 0,
	`status` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `whatsapp_auto_sends_id` PRIMARY KEY(`id`),
	CONSTRAINT `whatsapp_auto_sends_sendDate_unique` UNIQUE(`sendDate`)
);
--> statement-breakpoint
CREATE INDEX `idx_whatsapp_auto_sends_sendDate` ON `whatsapp_auto_sends` (`sendDate`);